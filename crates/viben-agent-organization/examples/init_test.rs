use std::env;
use std::path::Path;
use viben_agent_organization::{init_viben_agent_organization, InitOptions, ProjectType};

fn main() {
    let args: Vec<String> = env::args().collect();
    let target_dir = args.get(1).map(|s| s.as_str()).unwrap_or("/tmp/viben-test");
    let developer_name = args.get(2).map(|s| s.as_str()).unwrap_or("test-dev");

    let path = Path::new(target_dir);
    std::fs::create_dir_all(path).unwrap();

    init_viben_agent_organization(
        path,
        InitOptions {
            developer_name: developer_name.to_string(),
            project_type: ProjectType::Fullstack,
            force: true,
            skip_existing: false,
        },
    )
    .expect("Failed to initialize");

    println!("Initialized viben workspace at {}", target_dir);
}
