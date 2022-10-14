import { useState, useEffect } from "react";
import moment from "moment";
import {
  Button,
  Table,
  Panel,
  Placeholder,
  ButtonToolbar,
  Tooltip,
  Whisper,
  Tag,
  Notification,
  useToaster,
  Modal,
  Message,
  Stack,
  DatePicker,
  Uploader,
  Form,
  IconButton,
} from "rsuite";
import MoreIcon from "@rsuite/icons/legacy/More";
import Api, { Snapshot } from "./Api";
import PlusIcon from "@rsuite/icons/Plus";
import { MessageType } from "rsuite/esm/Notification/Notification";
// import { resourceLimits } from "worker_threads";
// import { isNullOrUndefined } from "util";

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

  const delToaster = useToaster();
  const notificationToaster = useToaster();
  const notification = (type: MessageType, msg: string) => {
    return (
      <Message showIcon type={type}>
        {msg}
      </Message>
    );
  };

  const message = (snapId: number) => {
    return (
      <Notification type="warning" header="warning" closable duration={0}>
        <Modal.Body>This operation cannot be undone,Sure?</Modal.Body>
        <hr />
        <Button
          size="sm"
          onClick={async () => {
            // TODO: Warning
            const res = await Api.deleteSnapshot(snapId);
            console.log(res);
            loadData();
            delToaster.clear();
            notificationToaster.push(notification("success", "success"), {
              placement: "topCenter",
            });
          }}
        >
          confirm
        </Button>
      </Notification>
    );
  };

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
                const snapshot = rawData as Snapshot;
                return (
                  <div style={{ marginTop: "-3px" }}>
                    <ButtonToolbar>
                      <Button
                        size="sm"
                        onClick={() => {
                          location.href =
                            "/editor?viewing-snapshot=" + String(snapshot.id);
                        }}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          const token = await Api.getSnapshotDownloadToken(
                            snapshot.id
                          );
                          if (token.ok) {
                            window.open(
                              Api.backendUrl +
                                "misc/download?token=" +
                                token.ok,
                              "_blank"
                            );
                          } else {
                            //TODO: error handling
                          }
                        }}
                      >
                        Download
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          delToaster.push(message(snapshot.id), {
                            placement: "topCenter",
                          })
                        }
                      >
                        Delete
                      </Button>
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

  const [openImportModel, setOpenImportModel] = useState(false);
  const fileUploadUrl = Api.backendUrl + "misc/upload";
  const headers = Api.tokenHeaders;

  type UploadDialogState = {
    uploadDate: Date | null;
    uploadToken: string | null;
  };
  const [uploadDialogState, setUploadDialogState] =
    useState<UploadDialogState | null>(null);

  type FileUploadState = "waiting" | "running" | "finished";

  const [isFileUpload, setIsFileUpload] = useState<FileUploadState>("waiting");

  return (
    <div style={{ marginTop: "2vh" }}>
      <Panel
        header={
          <Stack justifyContent="space-between">
            <span>Snapshots</span>
            <IconButton
              icon={<PlusIcon />}
              appearance="ghost"
              onClick={() => {
                setOpenImportModel(true);
                setIsFileUpload("waiting");
                setUploadDialogState({ uploadDate: null, uploadToken: null });
              }}
            >
              upload
            </IconButton>
          </Stack>
        }
      >
        <Detail />
      </Panel>

      <Modal
        open={openImportModel}
        onClose={() => {
          setOpenImportModel(false);
          setIsFileUpload("waiting");
        }}
        backdrop={"static"}
      >
        <Modal.Header>
          <Modal.Title>Upload Data</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <DatePicker
              format="yyyy-MM-dd HH:mm"
              size="lg"
              placeholder="Select Date"
              onChange={(date) => {
                if (date) {
                  setUploadDialogState({
                    uploadDate: date,
                    uploadToken: uploadDialogState!.uploadToken,
                  });
                  console.log(uploadDialogState);
                }
              }}
              style={{ width: 200, display: "block", marginBottom: 10 }}
            />

            <Uploader
              action={fileUploadUrl}
              headers={headers}
              disabled={isFileUpload == "waiting" ? false : true}
              accept=".zip"
              onUpload={(files) => {
                console.log(files);
                setIsFileUpload("running");
              }}
              onRemove={(file) => {
                console.log(file);
                setIsFileUpload("waiting");
                setUploadDialogState({
                  uploadDate: uploadDialogState!.uploadDate,
                  uploadToken: null,
                });
              }}
              onError={(res, files) => {
                console.log(files);
                console.log(res);
                setIsFileUpload("waiting");
                setUploadDialogState({
                  uploadDate: uploadDialogState!.uploadDate,
                  uploadToken: null,
                });
                notificationToaster.push(notification("error", "error"));
              }}
              onSuccess={(res) => {
                setUploadDialogState({
                  uploadDate: uploadDialogState!.uploadDate,
                  uploadToken: res.upload_token,
                });
                console.log(uploadDialogState);
                setIsFileUpload("finished");
              }}
              draggable
            >
              <div
                style={{
                  height: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span>
                  {isFileUpload == "waiting"
                    ? "Click or Drag a .zip file to this area to upload"
                    : isFileUpload == "running"
                    ? "uploading..."
                    : isFileUpload == "finished"
                    ? "success!"
                    : "Click or Drag a .zip file to this area to upload"}
                </span>
              </div>
            </Uploader>

            <Modal.Footer style={{ marginTop: "16px" }}>
              <Form.Group>
                <ButtonToolbar>
                  <Button
                    disabled={
                      uploadDialogState?.uploadDate &&
                      uploadDialogState?.uploadToken
                        ? false
                        : true
                    }
                    type="submit"
                    appearance="primary"
                    onClick={async () => {
                      console.log(uploadDialogState);

                      const result = await Api.uploadSnapshot(
                        uploadDialogState!.uploadDate as Date,
                        uploadDialogState!.uploadToken as string
                      );
                      console.log(result.status);
                      if (result.status == 200) {
                        notificationToaster.push(
                          notification("success", "Success!")
                        );
                        loadData();
                        setOpenImportModel(false);
                      } else {
                        notificationToaster.push(
                          notification("error", "unknow error")
                        );
                      }
                    }}
                  >
                    Submit
                  </Button>
                </ButtonToolbar>
              </Form.Group>
            </Modal.Footer>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default DashboardSnapshot;
