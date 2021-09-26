import React, { useState } from "react";
import Map from "./Map";
import MainMenu, { Actions } from "./MainMenu";
import GithubCorner from "./GithubCorner";
import Import from "./Import";

function App() {
  let [importDialog, setImportDialog] = useState(false);

  return (
    <div>
      <Import isOpen={importDialog} setIsOpen={setImportDialog} />
      <GithubCorner />
      <MainMenu
        onAction={(action: Actions) => {
          if (action === Actions.Import) {
            setImportDialog(true);
          }
        }}
      />
      <Map />
    </div>
  );
}

export default App;
