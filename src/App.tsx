import React, { useState } from "react";
import Map from "./Map";
import MainMenu, { Actions } from "./MainMenu";
import GithubCorner from "./GithubCorner";
import Import from "./Import";
import { MapRenderer } from "./utils/MapRenderer";

function App(): JSX.Element {
  const [importDialog, setImportDialog] = useState(false);

  return (
    <div>
      <Import isOpen={importDialog} setIsOpen={setImportDialog} />
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
      <Map />
    </div>
  );
}

export default App;
