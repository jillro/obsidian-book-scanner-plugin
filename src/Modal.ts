import "barcode-detector/polyfill";
import { App, Modal, normalizePath, Notice } from "obsidian";
import { BookScannerPluginSettings } from "./SettingsTab";

const GoogleBooksApiKey = "AIzaSyDvYltBC7qOSss_ILFv58mE1qg4fx7fpW8";

interface GoogleApiBooksResponse {
  items: Array<{
    volumeInfo: {
      title?: string;
      authors?: string[];
      publisher?: string;
      publishedDate?: string;
      imageLinks?: {
        thumbnail: string;
      };
      industryIdentifiers?: {
        type: "ISBN_10" | "ISBN_13";
        identifier: string;
      }[];
    };
  }>;
}

class CameraModal extends Modal {
  chosenFolderPath: string;
  videoStream: MediaStream = null;
  interval: number;
  constructor(app: App, cameraSettings: BookScannerPluginSettings) {
    super(app);
    this.chosenFolderPath = cameraSettings.chosenFolderPath;
  }

  async onOpen() {
    const { contentEl } = this;
    const webCamContainer = contentEl.createDiv();

    const statusMsg = webCamContainer.createEl("span", {
      text: "Loading..",
    });
    const videoEl = webCamContainer.createEl("video");
    const buttonsDiv = webCamContainer.createDiv();
    const firstRow = buttonsDiv.createDiv();
    const switchCameraButton = firstRow.createEl("button", {
      text: "Switch Camera",
    });
    firstRow.style.display = "none";

    videoEl.autoplay = true;
    videoEl.muted = true;
    videoEl.style.width = "100%";
    videoEl.style.height = "auto";
    this.videoStream = null;

    const cameras = (await navigator.mediaDevices.enumerateDevices()).filter(
      (d) => d.kind === "videoinput",
    );

    if (cameras.length <= 1) switchCameraButton.style.display = "none";
    let cameraIndex = 0;

    const getVideoStream = async () => {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { deviceId: cameras[cameraIndex].deviceId },
          audio: true,
        });
      } catch (error) {
        console.log(error);
        return null;
      }
    };

    this.videoStream = await getVideoStream();
    if (this.videoStream) {
      firstRow.style.display = "block";
      statusMsg.style.display = "none";
    } else {
      statusMsg.textContent = "Error in loading videostream in your device..";
    }

    const saveBook = async (barcode: string) => {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${barcode}&key=${GoogleBooksApiKey}`,
      );
      const bookInfo = (await res.json()) as GoogleApiBooksResponse;
      if (bookInfo.items.length == 0) {
        new Notice(`No book found with ISBN: ${barcode}`);
        return;
      }
      const volumeInfo = bookInfo.items[0].volumeInfo;

      const filePath = this.chosenFolderPath + "/" + volumeInfo.title + ".md";
      const folderExists = this.app.vault.getAbstractFileByPath(
        this.chosenFolderPath,
      );
      if (!folderExists)
        await this.app.vault.createFolder(this.chosenFolderPath);

      const file = await this.app.vault.create(normalizePath(filePath), "");

      // Put info in YAML frontmatter
      // @ts-ignore
      this.app.fileManager.processFrontMatter(file, (frontmatter: any) => {
        Object.assign(frontmatter, {
          title: volumeInfo.title,
          ...(volumeInfo.authors ? { authors: volumeInfo.authors } : {}),
          ...(volumeInfo.publisher ? { publisher: volumeInfo.publisher } : {}),
          ...(volumeInfo.publishedDate
            ? { publishedDate: volumeInfo.publishedDate }
            : {}),
          ...(volumeInfo.industryIdentifiers.find((i) => i.type == "ISBN_13")
            ? {
                isbn: volumeInfo.industryIdentifiers.find(
                  (i) => i.type == "ISBN_13",
                ).identifier,
              }
            : {}),
        });
      });

      await this.app.workspace.getLeaf(true).openFile(file, {
        active: true,
      });
    };

    switchCameraButton.onclick = async () => {
      cameraIndex = (cameraIndex + 1) % cameras.length;
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: cameras[cameraIndex].deviceId },
        audio: true,
      });
      videoEl.srcObject = this.videoStream;
      videoEl.play();
    };

    videoEl.srcObject = this.videoStream;

    videoEl.onloadedmetadata = () => {
      if (!("BarcodeDetector" in globalThis)) {
        console.log("Barcode Detector is not supported by this browser.");
      } else {
        console.log("Barcode Detector supported!");

        // create new detector
        const barcodeDetector = new BarcodeDetector({
          formats: [
            "code_128",
            "code_39",
            "code_39",
            "codabar",
            "ean_13",
            "ean_8",
            "itf",
            "upc_a",
            "upc_e",
          ],
        });

        this.interval = window.setInterval(async () => {
          // Extract a still from the video stream
          const canvas = webCamContainer.createEl("canvas");
          canvas.style.display = "none";
          const { videoHeight, videoWidth } = videoEl;
          canvas.height = videoHeight;
          canvas.width = videoWidth;

          canvas
            .getContext("2d")
            .drawImage(videoEl, 0, 0, videoWidth, videoHeight);
          const barcodes = await barcodeDetector.detect(canvas);
          if (barcodes.length == 0) {
            console.log("Nothing");
            return;
          }

          clearInterval(this.interval);
          this.interval = 0;
          await saveBook(barcodes[0].rawValue);
          this.close();
        }, 500);
      }
    };
  }

  onClose() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = 0;
    }
    const { contentEl } = this;
    this.videoStream?.getTracks().forEach((track) => {
      track.stop();
    });
    contentEl.empty();
  }
}

export default CameraModal;
