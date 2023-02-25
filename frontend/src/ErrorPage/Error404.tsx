import { ReactComponent as Image404 } from "./404.svg";
import { Button, FlexboxGrid, Grid, Row, Col } from "rsuite";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

function Error404() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <>
      <FlexboxGrid justify="center" align="middle" style={{ height: "100vh" }}>
        <Grid>
          <Row>
            <Col xs={6}></Col>
            <Col xs={12}>
              <Image404 />
            </Col>
            <Col xs={6}></Col>
          </Row>
          <Row>
            <Col xs={6}></Col>
            <Col xs={12} style={{ textAlign: "center", marginTop: "10px" }}>
              <p>{t("error-page-404-text")}</p>
            </Col>
            <Col xs={6}></Col>
          </Row>
          <Row>
            <Col xs={6}></Col>
            <Col xs={12} style={{ textAlign: "center", marginTop: "10px" }}>
              <Button
                appearance="primary"
                onClick={() => {
                  navigate("/", { replace: false });
                }}
              >
                {t("error-page-404-button")}
              </Button>
            </Col>
            <Col xs={6}></Col>
          </Row>
        </Grid>
      </FlexboxGrid>
    </>
  );
}

export default Error404;
