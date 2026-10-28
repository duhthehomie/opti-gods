// The Updates tab is now software-release status only. Do not recreate the
// retired announcement feed when the application starts on an empty database.
// Historical announcement rows remain available to administrators.
export async function seedAnnouncements(): Promise<void> {}
