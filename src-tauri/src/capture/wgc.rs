//! Windows Graphics Capture で、選んだウィンドウの映像を受け取る。
//! 受け取るだけで、ウィンドウに描いたり、操作したりはしない。
//! 取り込み中は、Windows がウィンドウのまわりに黄色い枠を表示する(OS の機能。アプリは描いていない)。

use std::sync::{Arc, Mutex};

use image::RgbaImage;
use windows::core::{factory, Interface, Result};
use windows::Foundation::TypedEventHandler;
use windows::Graphics::Capture::{Direct3D11CaptureFramePool, GraphicsCaptureItem, GraphicsCaptureSession};
use windows::Graphics::DirectX::Direct3D11::IDirect3DDevice;
use windows::Graphics::DirectX::DirectXPixelFormat;
use windows::Graphics::SizeInt32;
use windows::Win32::Foundation::{HMODULE, HWND};
use windows::Win32::Graphics::Direct3D::D3D_DRIVER_TYPE_HARDWARE;
use windows::Win32::Graphics::Direct3D11::{
    D3D11CreateDevice, ID3D11Device, ID3D11DeviceContext, ID3D11Texture2D, D3D11_BIND_FLAG, D3D11_CPU_ACCESS_READ,
    D3D11_CREATE_DEVICE_BGRA_SUPPORT, D3D11_MAPPED_SUBRESOURCE, D3D11_MAP_READ, D3D11_RESOURCE_MISC_FLAG, D3D11_SDK_VERSION,
    D3D11_TEXTURE2D_DESC, D3D11_USAGE_STAGING,
};
use windows::Win32::Graphics::Dxgi::IDXGIDevice;
use windows::Win32::System::WinRT::Direct3D11::{CreateDirect3D11DeviceFromDXGIDevice, IDirect3DDxgiInterfaceAccess};
use windows::Win32::System::WinRT::Graphics::Capture::IGraphicsCaptureItemInterop;

/// 取り込み対象(ウィンドウ)を作る
pub fn item_for_window(hwnd: HWND) -> Result<GraphicsCaptureItem> {
    let interop = factory::<GraphicsCaptureItem, IGraphicsCaptureItemInterop>()?;
    unsafe { interop.CreateForWindow(hwnd) }
}

struct Gpu {
    device: ID3D11Device,
    context: ID3D11DeviceContext,
    winrt: IDirect3DDevice,
}

// D3D11 のデバイスは複数のスレッドから使ってよい。コンテキストは Mutex の中でだけ使う。
unsafe impl Send for Gpu {}
unsafe impl Sync for Gpu {}

fn create_gpu() -> Result<Gpu> {
    let mut device = None;
    let mut context = None;
    unsafe {
        D3D11CreateDevice(
            None,
            D3D_DRIVER_TYPE_HARDWARE,
            HMODULE::default(),
            D3D11_CREATE_DEVICE_BGRA_SUPPORT,
            None,
            D3D11_SDK_VERSION,
            Some(&mut device),
            None,
            Some(&mut context),
        )?;
    }
    let device = device.unwrap();
    let dxgi: IDXGIDevice = device.cast()?;
    let winrt: IDirect3DDevice = unsafe { CreateDirect3D11DeviceFromDXGIDevice(&dxgi)? }.cast()?;
    Ok(Gpu { device, context: context.unwrap(), winrt })
}

/// GPU 上の画像を読み出して RGBA にする
fn read_texture(gpu: &Gpu, tex: &ID3D11Texture2D) -> Result<RgbaImage> {
    let mut desc = D3D11_TEXTURE2D_DESC::default();
    unsafe { tex.GetDesc(&mut desc) };
    desc.Usage = D3D11_USAGE_STAGING;
    desc.BindFlags = D3D11_BIND_FLAG(0).0 as u32;
    desc.CPUAccessFlags = D3D11_CPU_ACCESS_READ.0 as u32;
    desc.MiscFlags = D3D11_RESOURCE_MISC_FLAG(0).0 as u32;
    let mut staging = None;
    unsafe { gpu.device.CreateTexture2D(&desc, None, Some(&mut staging))? };
    let staging = staging.unwrap();
    unsafe { gpu.context.CopyResource(&staging, tex) };

    let mut mapped = D3D11_MAPPED_SUBRESOURCE::default();
    unsafe { gpu.context.Map(&staging, 0, D3D11_MAP_READ, 0, Some(&mut mapped))? };
    let (w, h) = (desc.Width, desc.Height);
    let mut rgba = vec![0u8; (w * h * 4) as usize];
    let src = mapped.pData as *const u8;
    for y in 0..h as usize {
        let row = unsafe { std::slice::from_raw_parts(src.add(y * mapped.RowPitch as usize), w as usize * 4) };
        let dst = &mut rgba[y * w as usize * 4..(y + 1) * w as usize * 4];
        for (d, s) in dst.chunks_exact_mut(4).zip(row.chunks_exact(4)) {
            // BGRA → RGBA
            d[0] = s[2];
            d[1] = s[1];
            d[2] = s[0];
            d[3] = 255;
        }
    }
    unsafe { gpu.context.Unmap(&staging, 0) };
    Ok(RgbaImage::from_raw(w, h, rgba).expect("画像の大きさが合いません"))
}

/// 取り込みの実行中の状態。drop すると止まる
pub struct Capture {
    session: GraphicsCaptureSession,
    pool: Direct3D11CaptureFramePool,
}

impl Capture {
    /// 取り込みを始める。映像が来るたびに on_frame が(別のスレッドで)呼ばれる
    pub fn start<F>(item: &GraphicsCaptureItem, on_frame: F) -> Result<Capture>
    where
        F: Fn(RgbaImage) + Send + Sync + 'static,
    {
        let gpu = Arc::new(Mutex::new(create_gpu()?));
        let size = item.Size()?;
        let winrt = gpu.lock().unwrap().winrt.clone();
        let pool = Direct3D11CaptureFramePool::CreateFreeThreaded(&winrt, DirectXPixelFormat::B8G8R8A8UIntNormalized, 2, size)?;
        let session = pool.CreateCaptureSession(item)?;
        // マウスカーソルは写さない(古い Windows では使えないので、失敗しても気にしない)
        let _ = session.SetIsCursorCaptureEnabled(false);

        let last_size = Arc::new(Mutex::new(size));
        let gpu_for_handler = gpu.clone();
        pool.FrameArrived(&TypedEventHandler::<Direct3D11CaptureFramePool, windows::core::IInspectable>::new(
            move |pool, _| {
                let Some(pool) = pool.as_ref() else { return Ok(()) };
                let frame = pool.TryGetNextFrame()?;
                let content: SizeInt32 = frame.ContentSize()?;
                // ウィンドウの大きさが変わったら、受け取る側の大きさも合わせる
                {
                    let mut last = last_size.lock().unwrap();
                    if content.Width != last.Width || content.Height != last.Height {
                        *last = content;
                        let gpu = gpu_for_handler.lock().unwrap();
                        pool.Recreate(&gpu.winrt, DirectXPixelFormat::B8G8R8A8UIntNormalized, 2, content)?;
                        return Ok(());
                    }
                }
                let access: IDirect3DDxgiInterfaceAccess = frame.Surface()?.cast()?;
                let tex: ID3D11Texture2D = unsafe { access.GetInterface()? };
                let img = {
                    let gpu = gpu_for_handler.lock().unwrap();
                    read_texture(&gpu, &tex)?
                };
                // 枠の外(大きくなる前の余白)を切り落とす
                let (w, h) = (content.Width.max(1) as u32, content.Height.max(1) as u32);
                let img = if img.width() > w || img.height() > h {
                    image::imageops::crop_imm(&img, 0, 0, w.min(img.width()), h.min(img.height())).to_image()
                } else {
                    img
                };
                on_frame(img);
                Ok(())
            },
        ))?;
        session.StartCapture()?;
        Ok(Capture { session, pool })
    }
}

impl Drop for Capture {
    fn drop(&mut self) {
        let _ = self.session.Close();
        let _ = self.pool.Close();
    }
}
