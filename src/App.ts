import { Plugin } from "obsidian";
import CameraModal from "./Modal";
import BookScannerSettingsTab, {
  DEFAULT_SETTINGS,
  BookScannerPluginSettings,
} from "./SettingsTab";

export default class ObsidianBookScanner extends Plugin {
  settings: BookScannerPluginSettings;
  async onload() {
    await this.loadSettings();
    this.addRibbonIcon("book", "Scan book", (evt: MouseEvent) => {
      new CameraModal(this.app, this.settings).open();
    });
    this.addSettingTab(new BookScannerSettingsTab(this.app, this));

    this.addCommand({
      id: "Open book scanner modal",
      name: "Open book scanner modal",
      callback: () => {
        new CameraModal(this.app, this.settings).open();
      },
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
