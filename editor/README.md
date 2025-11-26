# Editor Frontend

This directory contains the frontend application for the Editor. It is designed to run independently.

## Function

Map:

- Show map. Standard view/ satllite view.
- Import 'Sync' from Fog of World and show on view.
- Export 'Sync' after editing.

Editing 'unfog':

- Allow user earse existed 'unfog'.
- Allow user draw new 'unfog'. Polygon node or freehand.
- Undo/Redo editing
- Fly to pecified coordinate.
- Or paste <Map URL> to parse and fly to.

## Prerequisites

- Node.js
- Yarn (package manager)

## Getting Started

Follow these steps to set up and run the editor locally.

### 1. Install Dependencies

Navigate to this directory and install the required packages:

```bash
yarn install
```

### 2. Configure Environment Variables

Create your local environment configuration file by copying the provided example:

```bash
cp .env.local.example .env.local
```

### 3. Setup Mapbox API Key

This project requires a Mapbox API key to render maps.

Edit `.env.local` . Set `REACT_APP_MAPBOX_TOKEN` variable.

```bash
REACT_APP_MAPBOX_TOKEN=<your_actual_token_here>
```

### 4. Run the Application

Start the development server:

```Bash
yarn start
```

The application typically runs at http://localhost:3000.

### Available Scripts

- `yarn start`: Runs the app in development mode.
- `yarn run cicheck`: Runs CI checks (linting, etc.).
- `yarn run autofix`: Automatically fixes linting errors where possible.
