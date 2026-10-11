# Privacy

Measurement Revisions 1.0.0 uses only the Obsidian vault and local Web APIs. It makes no network requests and contains no telemetry, login, payment, ads, or self-update code. The listing author's website is not a runtime dependency.

The note chooser filters vault Markdown file paths. Parsing reads only user-selected before/after notes, or the active note after the validate command. Creating a revision or saving a comparison writes a new note in the vault and opens it. Existing revision notes are not edited or deleted. The plugin does not access paths outside the vault.

Normal vault backups, synchronization, and encryption remain the user's responsibility and follow the application's existing configuration. No automated sync or external upload is introduced by this extension.
