//! Test notification example
//!
//! Run with: cargo run -p viben-core --example test_notification

use viben_core::notifications::{send_notification, set_app_name, SystemNotification};

fn main() {
    println!("📢 测试 viben-core 系统通知...\n");
    println!("平台: {}", std::env::consts::OS);

    #[cfg(target_os = "macos")]
    {
        println!("实现: osascript (原生 macOS 通知)");
        // 设置应用名称 - 通知将显示该应用的图标
        // 可选值: "Terminal", "Finder", "Safari", 或你自己的应用名
        set_app_name("Terminal");
        println!("应用: Terminal (通知将显示 Terminal 图标)\n");
    }

    #[cfg(target_os = "linux")]
    println!("实现: notify-rust (freedesktop)\n");

    #[cfg(target_os = "windows")]
    println!("实现: notify-rust (Windows Toast)\n");

    let notification = SystemNotification::new(
        "Viben 通知测试",
        "🎉 如果你看到这条消息，说明通知功能正常工作！",
    );

    match send_notification(&notification) {
        Ok(()) => println!("✅ 通知发送成功！"),
        Err(e) => println!("❌ 通知发送失败: {}", e),
    }
}
