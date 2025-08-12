import BookScanner from "main";
import { App, PluginSettingTab, Setting } from "obsidian";

export interface BookScannerPluginSettings {
  chosenFolderPath: string;
}

export const DEFAULT_SETTINGS: BookScannerPluginSettings = {
  chosenFolderPath: "books",
};

export default class BookScannerSettingsTab extends PluginSettingTab {
  plugin: BookScanner;

  constructor(app: App, plugin: BookScanner) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Book ISBN Scanner settings" });

    new Setting(containerEl)
      .setName("Folder Path")
      .setDesc("Folder where the new files should be saved")
      .addText((text) =>
        text
          .setPlaceholder("Enter a path")
          .setValue(this.plugin.settings.chosenFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.chosenFolderPath = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
