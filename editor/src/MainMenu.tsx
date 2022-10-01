import { useEffect, useState } from "react";
import { Popover, Tab, Transition } from "@headlessui/react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/solid";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { MapRenderer } from "./utils/MapRenderer";
import Import from "./Import";

export enum Actions {
  Import,
  Export,
}

type Props = {
  mapRenderer: MapRenderer;
  msgboxShow(title: string, msg: string): void;
};

export default function MainMenu(props: Props): JSX.Element {
  const { t, i18n } = useTranslation();
  const mapRenderer = props.mapRenderer;

  const [importDialog, setImportDialog] = useState(false);

  const menuItems = [
    {
      name: t("import"),
      description: t("import-description"),
      action: () => {
        setImportDialog(true);
      },
      icon: IconImport,
    },
    {
      name: t("export"),
      description: t("export-description"),
      action: async () => {
        // TODO: seems pretty fast, but we should consider handle this async properly
        const blob = await mapRenderer.fogMap.exportArchive();
        if (blob) {
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
          props.msgboxShow("info", "export-done-message");
        }
      },
      icon: IconExport,
    },
  ];

  const languageTab = (
    <div className="w-full pt-4 grid lg:grid-cols-2">
      <Tab.Group
        onChange={(index) => {
          if (index === 0) {
            i18n.changeLanguage("zh");
          } else {
            i18n.changeLanguage("en");
          }
        }}
        defaultIndex={i18n.resolvedLanguage === "zh" ? 0 : 1}
      >
        <Tab.List className="flex p-1 space-x-1 bg-gray-300 rounded-xl">
          {["简体中文", "English"].map((category) => (
            <Tab
              key={category}
              className={({ selected }) => {
                return (
                  "w-full py-1 text-sm leading-5 font-medium text-grey-500 rounded-lg focus:outline-none" +
                  (selected ? " bg-white" : " hover:bg-gray-200")
                );
              }}
            >
              {category}
            </Tab>
          ))}
        </Tab.List>
      </Tab.Group>
    </div>
  );

  return (
    <>
      <Import
        mapRenderer={mapRenderer}
        isOpen={importDialog}
        setIsOpen={setImportDialog}
        msgboxShow={props.msgboxShow}
      />
      <div className="absolute z-40 top-4 left-4">
        <div className="max-w-sm m-auto bg-white bg-opacity-90 rounded-xl shadow-md flex items-center space-x-4">
          <Popover className="relative">
            {({ open }) => (
              <>
                <Popover.Button
                  className={`
                ${open ? "" : "text-opacity-90"}
                text-black group px-3 py-2 rounded-md inline-flex items-center text-base font-medium hover:text-opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75`}
                >
                  <div className="p-0.5">
                    <span>{t("main-title")}</span>
                  </div>
                  {open ? (
                    <ChevronUpIcon
                      className="ml-2 h-5 w-5 group-hover:text-opacity-80 transition ease-in-out duration-150"
                      aria-hidden="true"
                    />
                  ) : (
                    <ChevronDownIcon
                      className="ml-2 h-5 w-5 group-hover:text-opacity-80 transition ease-in-out duration-150"
                      aria-hidden="true"
                    />
                  )}
                </Popover.Button>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-200"
                  enterFrom="opacity-0 translate-y-1"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in duration-150"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 translate-y-1"
                >
                  <Popover.Panel className="absolute z-10 w-screen max-w-sm mt-3 transform lg:max-w-3xl">
                    <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
                      <div className="relative grid gap-8 bg-white p-7 lg:grid-cols-2">
                        {menuItems.map((item) => (
                          <a
                            key={item.name}
                            onClick={item.action}
                            className="flex items-center cursor-pointer p-2 -m-3 transition duration-150 ease-in-out rounded-lg hover:bg-gray-50 focus:outline-none focus-visible:ring focus-visible:ring-orange-500 focus-visible:ring-opacity-50"
                          >
                            <div className="flex items-center justify-center flex-shrink-0 w-10 h-10 text-white sm:h-12 sm:w-12">
                              <item.icon aria-hidden="true" />
                            </div>
                            <div className="ml-4">
                              <p className="text-sm font-medium text-gray-900">
                                {item.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {item.description}
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>

                      <div className="p-4 bg-gray-50">
                        <span className="flex items-center">
                          <span className="text-sm font-medium text-gray-900">
                            {t("language")}
                          </span>
                        </span>
                        {languageTab}
                      </div>
                    </div>
                  </Popover.Panel>
                </Transition>
              </>
            )}
          </Popover>
        </div>
      </div>
    </>
  );
}

function IconImport() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="48" height="48" rx="8" fill="#FFEDD5" />
      <svg
        x="8"
        y="8"
        width="32"
        height="32"
        aria-hidden="true"
        focusable="false"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
      >
        <path
          fill="#FDBA74"
          d="M16 288c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h112v-64zm489-183L407.1 7c-4.5-4.5-10.6-7-17-7H384v128h128v-6.1c0-6.3-2.5-12.4-7-16.9zm-153 31V0H152c-13.3 0-24 10.7-24 24v264h128v-65.2c0-14.3 17.3-21.4 27.4-11.3L379 308c6.6 6.7 6.6 17.4 0 24l-95.7 96.4c-10.1 10.1-27.4 3-27.4-11.3V352H128v136c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H376c-13.2 0-24-10.8-24-24z"
        />
      </svg>
    </svg>
  );
}

function IconExport() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="48" height="48" rx="8" fill="#FFEDD5" />
      <svg
        x="8"
        y="8"
        width="32"
        height="32"
        aria-hidden="true"
        focusable="false"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
      >
        <path
          fill="#FDBA74"
          d="M216 0h80c13.3 0 24 10.7 24 24v168h87.7c17.8 0 26.7 21.5 14.1 34.1L269.7 378.3c-7.5 7.5-19.8 7.5-27.3 0L90.1 226.1c-12.6-12.6-3.7-34.1 14.1-34.1H192V24c0-13.3 10.7-24 24-24zm296 376v112c0 13.3-10.7 24-24 24H24c-13.3 0-24-10.7-24-24V376c0-13.3 10.7-24 24-24h146.7l49 49c20.1 20.1 52.5 20.1 72.6 0l49-49H488c13.3 0 24 10.7 24 24zm-124 88c0-11-9-20-20-20s-20 9-20 20 9 20 20 20 20-9 20-20zm64 0c0-11-9-20-20-20s-20 9-20 20 9 20 20 20 20-9 20-20z"
        />
      </svg>
    </svg>
  );
}
