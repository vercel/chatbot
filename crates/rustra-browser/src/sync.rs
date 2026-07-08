//! Poison-recovering lock helpers shared across the crate.
//!
//! A panicked holder cannot leave these collections in an invalid state
//! (every mutation is a single push/pop/insert/remove), so recover from
//! poisoning rather than propagating it.

/// Lock a [`Mutex`](std::sync::Mutex), recovering from poisoning.
pub(crate) fn lock<T>(mutex: &std::sync::Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

/// Read-lock an [`RwLock`](std::sync::RwLock), recovering from poisoning.
pub(crate) fn read<T>(lock: &std::sync::RwLock<T>) -> std::sync::RwLockReadGuard<'_, T> {
    lock.read()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

/// Write-lock an [`RwLock`](std::sync::RwLock), recovering from poisoning.
pub(crate) fn write<T>(lock: &std::sync::RwLock<T>) -> std::sync::RwLockWriteGuard<'_, T> {
    lock.write()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}
