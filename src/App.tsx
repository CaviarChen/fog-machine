import React, { Fragment, useState } from "react";
import Map from "./Map";
import MainMenu, { Actions } from "./MainMenu";
import GithubCorner from "./GithubCorner";
import Import from "./Import";
import { MapRenderer } from "./utils/MapRenderer";
import { Dialog, Transition } from "@headlessui/react";

function App(): JSX.Element {
  const [importDialog, setImportDialog] = useState(false);
  const [msgboxState, setMsgboxState] = useState({
    isOpen: false,
    title: "",
    msg: "",
  });

  function msgboxClose() {
    setMsgboxState({ ...msgboxState, isOpen: false });
  }

  function msgboxShow(title: string, msg: string) {
    setMsgboxState({ isOpen: true, title: title, msg: msg });
  }

  const msgbox = (
    <Transition appear show={msgboxState.isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="fixed inset-0 z-10 overflow-y-auto"
        onClose={msgboxClose}
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
                {msgboxState.title}
              </Dialog.Title>
              <div className="mt-2">
                <p className="text-sm text-gray-500">{msgboxState.msg}</p>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  className="inline-flex justify-center px-4 py-2 text-sm font-medium text-blue-900 bg-blue-100 border border-transparent rounded-md hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                  onClick={msgboxClose}
                >
                  OK
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );

  return (
    <div>
      <Import
        isOpen={importDialog}
        setIsOpen={setImportDialog}
        msgboxShow={msgboxShow}
      />
      <GithubCorner />
      <MainMenu
        onAction={async (action: Actions) => {
          if (action === Actions.Import) {
            setImportDialog(true);
          } else if (action === Actions.Export) {
            // TODO: seems pretty fast, but we should consider handle this async properly
            const blob = await MapRenderer.get().fogMap.exportArchive();

            const name = "Sync.zip";
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = blobUrl;
            link.download = name;

            document.body.appendChild(link);
            // This is necessary as link.click() does not work on the latest firefox
            link.dispatchEvent(
              new MouseEvent("click", {
                bubbles: true,
                cancelable: true,
                view: window,
              })
            );
            document.body.removeChild(link);
          }
        }}
      />
      {msgbox}
      <Map />
    </div>
  );
}

export default App;
