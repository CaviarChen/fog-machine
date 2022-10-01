import React, { Fragment, useState } from "react";
import Editor from "./Editor";
import GithubCorner from "./GithubCorner";
import { MapRenderer } from "./utils/MapRenderer";
import Map from "./Map";
import { Dialog, Transition } from "@headlessui/react";
import { useTranslation } from "react-i18next";

function App(): JSX.Element {
  const { t } = useTranslation();
  const t_ = (key: string | null) => {
    if (key) {
      return t(key);
    } else {
      return "";
    }
  };

  const [mapRenderer, setMapRenderer] = useState<MapRenderer | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [msgboxState, setMsgboxState] = useState<{
    isOpen: boolean;
    title: null | string;
    msg: null | string;
  }>({
    isOpen: false,
    title: null,
    msg: null,
  });

  const msgboxClose = () => {
    setMsgboxState({ ...msgboxState, isOpen: false });
  };

  const msgboxShow = (title: string, msg: string) => {
    setMsgboxState({ isOpen: true, title: title, msg: msg });
  };

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
                {t_(msgboxState.title)}
              </Dialog.Title>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  {t_(msgboxState.msg)
                    .split("\n")
                    .map((item) => {
                      return (
                        <>
                          {" "}
                          {item} <br />
                        </>
                      );
                    })}
                </p>
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

  const loadingSpinner = (
    <div className="flex h-screen">
      <svg
        className="animate-spin h-12 w-12 m-auto text-black"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
    </div>
  );

  const Mode = () => {
    if (!mapRenderer) return <></>;
    return (
      <Editor
        mapRenderer={mapRenderer}
        setLoaded={setLoaded}
        msgboxShow={msgboxShow}
      />
    );
  };

  return (
    <>
      <GithubCorner />
      <div className={loaded ? "" : "invisible"}>
        <Map
          note="THIS SHOULDN'T BE UNMOUNTED"
          initialized={(mapRenderer) => {
            setMapRenderer(mapRenderer);
            setLoaded(true);
          }}
        />
        {msgbox}
        <Mode />
      </div>
      {loaded ? <></> : loadingSpinner}
    </>
  );
}

export default App;
