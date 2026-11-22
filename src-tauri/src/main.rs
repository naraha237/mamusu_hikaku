// リリース版でコンソール窓を出さない(削除しないこと)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mamusu_hikaku_lib::run()
}
