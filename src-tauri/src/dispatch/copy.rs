use std::path::PathBuf;
use anyhow::Result;

/// Recursively copy a directory from source to destination
pub fn copy_dir(source: &PathBuf, destination: &PathBuf) -> Result<(), String> {
    // Create destination directory
    std::fs::create_dir_all(destination)
        .map_err(|e| format!("Failed to create destination directory: {}", e))?;

    // Iterate over entries in source directory
    for entry in std::fs::read_dir(source)
        .map_err(|e| format!("Failed to read source directory: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let entry_path = entry.path();
        let dest_path = destination.join(entry.file_name());

        if entry_path.is_dir() {
            // Recursively copy subdirectories
            copy_dir(&entry_path, &dest_path)?;
        } else {
            // Copy files
            std::fs::copy(&entry_path, &dest_path)
                .map_err(|e| format!("Failed to copy file {}: {}", entry_path.display(), e))?;
        }
    }

    Ok(())
}
