//! Known models database
//!
//! This module previously contained predefined models but now returns an empty list.
//! All models are user-configured via ~/.viben/models.yaml or workspace config.

use crate::providers::ProviderType;

use super::types::KnownModel;

/// Get all known models (empty - all models are user-configured)
pub fn get_known_models() -> Vec<KnownModel> {
    vec![]
}

/// Get known models for a specific provider (always empty - all models are user-configured)
#[allow(unused_variables)]
pub fn get_known_models_for_provider(_provider: ProviderType) -> Vec<KnownModel> {
    vec![]
}

/// Find a known model by ID (always None - all models are user-configured)
#[allow(unused_variables)]
pub fn find_known_model(_id: &str) -> Option<KnownModel> {
    None
}
