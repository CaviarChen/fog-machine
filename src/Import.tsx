import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { readFileAsync } from "./Utils";
import { MapRenderer } from "./utils/MapRenderer";
import { useDropzone } from "react-dropzone";
import JSZip from "jszip";
import parsePath from "parse-filepath";

type Props = {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  msgboxShow(title: string, msg: string): void;
};

let isImported = false;

export default function MyModal(props: Props): JSX.Element {
  const { isOpen, setIsOpen, msgboxShow } = props;

  async function importFiles(files: File[]) {
    closeModal();
    if (isImported) {
      msgboxShow(
        "Error",
        "You already imported data from [Fog of World]. Refresh the page if you want to start over."
      );
      return;
    }

    console.log(files);
    // TODO: error handling
    // TODO: progress bar
    // TODO: improve file checking
    let done = false;
    const mapRenderer = MapRenderer.get();
    if (files.every((file) => parsePath(file.name).ext === "")) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file) {
          const data = await readFileAsync(file);
          if (data instanceof ArrayBuffer) {
            mapRenderer.addFoGFile(file.name, data, false);
          }
        }
      }
      done = true;
    } else {
      if (files.length === 1 && parsePath(files[0].name).ext === ".zip") {
        const data = await readFileAsync(files[0]);
        if (data instanceof ArrayBuffer) {
          const zip = await new JSZip().loadAsync(data);
          for (const filename in zip.files) {
            const data = await zip.files[filename].async("arraybuffer");
            mapRenderer.addFoGFile(filename, data, false);
          }
        }
        done = true;
      }
    }

    if (done) {
      mapRenderer.redrawArea(null);
      // we need this because we do not support overriding in `mapRenderer.addFoGFile`
      isImported = true;
      // TODO: move to center?
    } else {
      msgboxShow("Error", "Invalid format");
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
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="fixed inset-0 z-40 overflow-y-auto"
        onClose={closeModal}
      >
        <div className="min-h-screen px-4 text-center">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0" />
          </Transition.Child>

          {/* This element is to trick the browser into centering the modal contents. */}
          <span
            className="inline-block h-screen align-middle"
            aria-hidden="true"
          >
            &#8203;
          </span>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <Dialog.Title
                as="h3"
                className="text-lg font-medium leading-6 text-gray-900"
              >
                Import data
              </Dialog.Title>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  All your data will be handled locally.
                  <br />
                  <br />
                  Accept data format:
                  <br />
                  - The "Sync" folder.
                  <br />
                  - Files in the "Sync" folder.
                  <br />
                  - A zip archive contains the "Sync" folder.
                  <br />
                  <br />
                </p>
              </div>
              <div className="pt-4">
                <div className="border-2 border-dashed border-gray-300 border-opacity-100 rounded-lg">
                  <div {...getRootProps({ className: "dropzone" })}>
                    <input {...getInputProps()} />
                    <div className="py-4 w-min mx-auto">
                      <div className="mb-4 whitespace-nowrap">
                        drag and drop [Fog of World] sync data
                      </div>
                      <div className="w-min mx-auto">
                        <button
                          type="button"
                          className="inline-flex justify-center px-4 py-2 text-sm font-medium text-blue-900 bg-blue-100 border border-transparent rounded-md hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                          onClick={openFileSelector}
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
