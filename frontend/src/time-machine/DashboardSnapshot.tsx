import { useState, useEffect } from "react";
import moment from "moment";
import {
  Button,
  Modal,
  Table,
  Panel,
  Placeholder,
  ButtonToolbar,
  Stack,
  Tooltip,
  Whisper,
  Tag,
  IconButton,
  Form,
  SelectPicker,
  InputGroup,
  Message,
  useToaster,
  Notification,
} from "rsuite";
import MoreIcon from "@rsuite/icons/legacy/More";
import Api, { Snapshot } from "./api";
import PauseIcon from "@rsuite/icons/legacy/Pause";
import FileTextIcon from "@rsuite/icons/legacy/FileText";
import PlayIcon from "@rsuite/icons/legacy/Play";
import PlayOutlineIcon from "@rsuite/icons/PlayOutline";
import PauseOutlineIcon from "@rsuite/icons/PauseOutline";
import CloseOutlineIcon from "@rsuite/icons/CloseOutline";
import EditIcon from "@rsuite/icons/Edit";
import AddOutlineIcon from "@rsuite/icons/AddOutline";
import HelpOutlineIcon from "@rsuite/icons/HelpOutline";

const { Column, HeaderCell, Cell } = Table;

function DashboardSnapshot() {
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const loadData = async () => {
    const result = await Api.listSnapshots();
    if (result.ok) {
      setSnapshots(result.ok);
    } else {
      console.log(result);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const Detail = () => {
    if (!snapshots) {
      return <Placeholder.Paragraph />;
    } else {
      return (
        <Table data={snapshots} id="table">
          <Column flexGrow={10}>
            <HeaderCell>Date</HeaderCell>
            <Cell>
              {(rawData) => {
                const snapshot = rawData as Snapshot;
                return (
                  <Whisper
                    placement="top"
                    trigger="hover"
                    speaker={
                      <Tooltip>
                        {moment(snapshot.timestamp).format("lll")}
                      </Tooltip>
                    }
                  >
                    <div>{moment(snapshot.timestamp).format("YYYY-MM-DD")}</div>
                  </Whisper>
                );
              }}
            </Cell>
          </Column>

          <Column flexGrow={10}>
            <HeaderCell>Source</HeaderCell>
            <Cell>
              {(rawData) => {
                const snapshot = rawData as Snapshot;
                return (
                  <Tag>{snapshot.sourceKind == "Sync" ? "Sync" : "Upload"}</Tag>
                );
              }}
            </Cell>
          </Column>

          <Column flexGrow={10} verticalAlign="middle">
            <HeaderCell>
              <MoreIcon />
            </HeaderCell>
            <Cell>
              {(rawData) => {
                const _snapshot = rawData as Snapshot;
                return (
                  <div style={{ marginTop: "-3px" }}>
                    <ButtonToolbar>
                      <Button size="sm">View</Button>
                      <Button size="sm">Download</Button>
                    </ButtonToolbar>
                  </div>
                );
              }}
            </Cell>
          </Column>
        </Table>
      );
    }
  };

  return (
    <div style={{ marginTop: "2vh" }}>
      <Panel header="Snapshots">
        <Detail />
      </Panel>
    </div>
  );
}

export default DashboardSnapshot;
