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
import { useTranslation } from "react-i18next";

const { Column, HeaderCell, Cell } = Table;

function DashboardSnapshot() {
  const { t } = useTranslation();
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

  // TODO: we should have a single global toaster for all notifications
  const notificationToaster = useToaster();

  const notification = (type: MessageType, msg: string) => {
    return (
      <Message showIcon type={type}>
        {msg}
      </Message>
    );
  };

  const openDeleteConfirmation = (snapshotId: number) => {
    // TODO: It is a bit wierd to use `Notifaction` as a modal. Maybe we shoudln't do this, but it works okish for now.
    // e.g. when `Notifaction` is open, user can still click other things on the page.
    //      no easy way to close the current one other than using `clear` which close all things.
    //      We *SHOULDN'T* allow user to open multiple confirmation, that's really confusing.

    const message = (
      <Notification type="info" header="Delete snapshot" closable duration={0}>
        This item will be deleted immediately. You can't undo this action.
        <hr />
        <Button
          size="sm"
          onClick={async () => {
            notificationToaster.clear();
            const res = await Api.deleteSnapshot(snapshotId);
            // TODO: Error handling
            if (res.ok) {
              notificationToaster.push(notification("success", "success"), {
                placement: "topCenter",
              });
              loadData();
            } else {
              console.log(res);
            }
          }}
        >
          Confirm
        </Button>
      </Notification>
    );
    notificationToaster.push(message, {
      placement: "topCenter",
    });
  };

  const Detail = () => {
    if (!snapshots) {
      return <Placeholder.Paragraph />;
    } else {
      return (
        <Table data={snapshots} id="table">
          <Column flexGrow={10}>
            <HeaderCell>{t("snapshot-table-date")}</HeaderCell>
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
            <HeaderCell>{t("snapshot-table-source")}</HeaderCell>
            <Cell>
              {(rawData) => {
                const snapshot = rawData as Snapshot;
                return (
                  <Tag>
                    {snapshot.sourceKind == "Sync"
                      ? t("snapshot-table-source-sync")
                      : t("snapshot-table-source-upload")}
                  </Tag>
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
                        {t("snapshot-table-view")}
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
                        {t("snapshot-table-download")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => openDeleteConfirmation(snapshot.id)}
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

  const fileUploadUrl = Api.backendUrl + "misc/upload";
  const headers = Api.tokenHeaders;

  type UploadDialogState = {
    uploadDate: Date | null;
    uploadState: "empty" | "uploading" | { token: string };
  };
  const [uploadDialogState, setUploadDialogState] = useState<
    UploadDialogState | "closed"
  >("closed");

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
                setUploadDialogState({
                  uploadDate: null,
                  uploadState: "empty",
                });
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
        open={uploadDialogState != "closed"}
        onClose={() => {
          setUploadDialogState("closed");
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
                if (uploadDialogState == "closed") return;
                setUploadDialogState({
                  ...uploadDialogState,
                  uploadDate: date,
                });
              }}
              style={{ width: 200, display: "block", marginBottom: 10 }}
            />

            {/*
            TODO: `Uploader` will send the upload request directly. So the file will be uploaded when the user selected the file not when they click the submit button.
            I guess this is fine except that `upload_token` is only valid for 1 min, so if the user click submit after 1 min then this is not going to work.
             */}
            <Uploader
              action={fileUploadUrl}
              headers={headers}
              disableMultipart={true}
              multiple={false}
              disabled={
                uploadDialogState == "closed" ||
                uploadDialogState.uploadState != "empty"
              }
              accept=".zip"
              onUpload={(_files) => {
                if (uploadDialogState == "closed") return;
                setUploadDialogState({
                  ...uploadDialogState,
                  uploadState: "uploading",
                });
              }}
              onRemove={(_file) => {
                if (uploadDialogState == "closed") return;
                setUploadDialogState({
                  ...uploadDialogState,
                  uploadState: "empty",
                });
              }}
              onError={(res, files) => {
                console.log(files);
                console.log(res);
                if (uploadDialogState == "closed") return;
                setUploadDialogState({
                  ...uploadDialogState,
                  uploadState: "empty",
                });
                notificationToaster.push(notification("error", "error"));
              }}
              onSuccess={(res) => {
                if (uploadDialogState == "closed") return;
                setUploadDialogState({
                  ...uploadDialogState,
                  uploadState: { token: res.upload_token },
                });
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
                  {uploadDialogState == "closed" ||
                  uploadDialogState.uploadState == "empty"
                    ? "Click or Drag a .zip file to this area to upload"
                    : uploadDialogState.uploadState == "uploading"
                    ? "uploading..."
                    : "success!"}
                </span>
              </div>
            </Uploader>

            <Modal.Footer style={{ marginTop: "16px" }}>
              <Form.Group>
                <ButtonToolbar>
                  <Button
                    disabled={
                      uploadDialogState == "closed" ||
                      !uploadDialogState.uploadDate ||
                      uploadDialogState.uploadState == "empty" ||
                      uploadDialogState.uploadState == "uploading"
                    }
                    type="submit"
                    appearance="primary"
                    onClick={async () => {
                      if (
                        uploadDialogState == "closed" ||
                        !uploadDialogState.uploadDate ||
                        uploadDialogState.uploadState == "empty" ||
                        uploadDialogState.uploadState == "uploading"
                      )
                        return;

                      const result = await Api.uploadSnapshot(
                        uploadDialogState.uploadDate,
                        uploadDialogState.uploadState.token
                      );
                      if (result.ok) {
                        notificationToaster.push(
                          notification("success", "Success!")
                        );
                        setUploadDialogState("closed");
                        loadData();
                      } else {
                        console.log(result);
                        let errorMessage = "Unknown error";
                        if (result.error == "timestamp_is_in_future") {
                          errorMessage =
                            "You cannot select a time that is in the future.";
                        } else if (result.error == "invalid_upload_token") {
                          errorMessage =
                            "Failed to load uploaded file, please reupload and try again.";
                          // TODO: We should reset the `Uploader` here, but currently this cannot be done because
                          // the way we use the `Uploader` is wrong.
                          // We should: not maintaing our own upload status and use `fileList`.
                          // see this example: https://rsuitejs.com/components/uploader/#controlled
                        }
                        notificationToaster.push(
                          notification("error", errorMessage)
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
