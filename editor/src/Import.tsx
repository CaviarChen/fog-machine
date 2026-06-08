import { readFileAsync } from "./Utils";
import { MapController } from "./utils/MapController";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { FogMap } from "./utils/FogMap";
import { importFowSyncZip } from "./utils/FowSyncArchive";
import { importFwss } from "./utils/FwssArchive";
import DialogFrame from "./DialogFrame";

type Props = {
  mapController: MapController;
  isOpen: boolean;
  setIsOpen(isOpen: boolean): void;
  msgboxShow(title: string, msg: string): void;
};

function getFileExtension(filename: string): string {
  return filename
    .slice((Math.max(0, filename.lastIndexOf(".")) || Infinity) + 1)
    .toLowerCase();
}

export default function MyModal(props: Props): JSX.Element {
  const { t } = useTranslation();
  const { isOpen, setIsOpen, msgboxShow } = props;

  async function importFiles(files: File[]) {
    const mapController = props.mapController;
    closeModal();
    if (mapController.fogMap !== FogMap.empty) {
      // we need this because we do not support overriding in `mapController.addFoGFile`
      msgboxShow("error", "error-already-imported");
      return;
    }

    console.log(files);
    // TODO: error handling
    // TODO: progress bar
    // TODO: improve file checking
    let done = false;
    files.forEach((file) => console.log(getFileExtension(file.name)));
    if (files.every((file) => getFileExtension(file.name) === "")) {
      const tileFiles = await Promise.all(
        files.map(async (file) => {
          const data = await readFileAsync(file);
          return [file.name, data] as [string, ArrayBuffer];
        })
      );
      const map = FogMap.createFromFiles(tileFiles);
      mapController.replaceFogMap(map);
      done = true;
    } else {
      if (files.length === 1 && getFileExtension(files[0].name) === "zip") {
        const data = await readFileAsync(files[0]);
        if (data instanceof ArrayBuffer) {
          const map = await importFowSyncZip(data);
          mapController.replaceFogMap(map);
        }
        done = true;
      } else if (
        files.length === 1 &&
        getFileExtension(files[0].name) === "fwss"
      ) {
        const data = await readFileAsync(files[0]);
        if (data instanceof ArrayBuffer) {
          const map = await importFwss(data);
          mapController.replaceFogMap(map);
        }
        done = true;
      }
    }

    if (done) {
      // TODO: move to center?
    } else {
      msgboxShow("error", "error-invalid-format");
    }
  }

  const { open, getRootProps, getInputProps } = useDropzone({
    noClick: true,
    noKeyboard: true,
    onDrop: (files) => importFiles(files),
  });
  const openFileSelector = open;

  function closeModal() {
    setIsOpen(false);
  }

  return (
    <DialogFrame
      isOpen={isOpen}
      onClose={closeModal}
      title={t("import")}
      description={t("import-dialog-description")}
    >
      <div className="border-2 border-dashed border-gray-300 border-opacity-100 rounded-lg">
        <div {...getRootProps({ className: "dropzone" })}>
          <input {...getInputProps()} />
          <div className="py-4 w-min mx-auto">
            <div className="mb-4 whitespace-nowrap">
              {t("import-dialog-drag-and-drop")}
            </div>
            <div className="w-min mx-auto">
              <button
                type="button"
                className="whitespace-nowrap px-4 py-2 text-sm font-medium text-blue-900 bg-blue-100 border border-transparent rounded-md hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                onClick={openFileSelector}
              >
                {t("import-dialog-select")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DialogFrame>
  );
}
