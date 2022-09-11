// TODO: type safe?
/* eslint-disable @typescript-eslint/no-explicit-any */

// TODO: too many duplicated code, refactor!

import axios from "axios";
import lodash from "lodash";

// I really want ADT x2
type Ok<T> = {
  ok: T;
  error?: never;
  unknownError?: never;
};

type Error = {
  ok?: never;
  error: [number, string];
  unknownError?: never;
};

type UnknownError = {
  ok?: never;
  error?: never;
  unknownError: string;
};

type Result<T> = Ok<T> | Error | UnknownError;

type UserInfo = { language: "zh-cn" | "en-us" };

type GithubSsoResponse = {
  login: boolean;
  token?: string;
  defaultEmail?: string;
  registrationToken?: string;
};

export type SnapshotTask = {
  errorCount: number;
  interval: number;
  nextSync: Date;
  source: { OneDrive: { shareUrl: string } };
  status: "Running" | "Paused" | "Stopped";
};

// TODO: [snakeToCamel] and [camelToSnake] are very silly.
function snakeToCamel(x: any): any {
  lodash.map;
  return lodash.mapKeys(x, function (_value, key) {
    return lodash.camelCase(key);
  });
}

function camelToSnake(x: any): any {
  return lodash.mapKeys(x, function (_value, key) {
    return lodash.snakeCase(key);
  });
}

export default class Api {
  public static readonly backendUrl =
    process.env.REACT_APP_BACKEND_URL + "/api/v1/";
  private static readonly tokenKey = "user-token";

  private static getToken(): string | null {
    let token = sessionStorage.getItem(this.tokenKey);
    if (!token) {
      token = localStorage.getItem(this.tokenKey);
    }
    return token;
  }

  private static clearToken() {
    sessionStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.tokenKey);
  }

  public static logout() {
    this.clearToken();
  }

  public static async getUserInfo(): Promise<UserInfo | null> {
    try {
      const token = this.getToken();
      if (!token) {
        return null;
      }
      const { data, status } = await axios.get<UserInfo>(
        this.backendUrl + "user",
        {
          headers: {
            Authorization: "Bearer " + token,
          },
        }
      );
      const _ = status;
      return data;
    } catch (_error) {
      return null;
    }
  }

  public static async githubSso(
    code: string
  ): Promise<Result<GithubSsoResponse>> {
    try {
      const { data: rawData, status: _ } = await axios.post(
        this.backendUrl + "user/sso/github",
        { code: code },
        {}
      );
      const data = snakeToCamel(rawData);

      if (data.login && data.token) {
        // TODO: only put the token to session storage if the user doesn't want to keep logged in
        localStorage.setItem(this.tokenKey, data.token);
      }
      return { ok: data };
    } catch (error: any) {
      const status = error.response?.status;
      const knownError = error.response?.data?.error;
      if (status && knownError) {
        return { error: [status, knownError] };
      } else {
        return { unknownError: String(error) };
      }
    }
  }

  public static async register(
    registrationToken: string,
    contactEmail: string,
    language: "zh-cn" | "en-us"
  ): Promise<Result<"ok">> {
    try {
      const { data: rawData, status: _ } = await axios.post(
        this.backendUrl + "user/sso",
        camelToSnake({
          registrationToken,
          contactEmail,
          language,
        }),
        {}
      );

      // TODO: only put the token to session storage if the user doesn't want to keep logged in
      localStorage.setItem(this.tokenKey, rawData.token);
      return { ok: "ok" };
    } catch (error: any) {
      const status = error.response?.status;
      const knownError = error.response?.data?.error;
      if (status && knownError) {
        return { error: [status, knownError] };
      } else {
        return { unknownError: String(error) };
      }
    }
  }

  public static async getSnapshotTask(): Promise<Result<SnapshotTask>> {
    try {
      const { data: rawData, status: _ } = await axios.get(
        this.backendUrl + "snapshot_task",
        {
          headers: { Authorization: "Bearer " + this.getToken() },
        }
      );

      const data = snakeToCamel(rawData);
      if (data.source["OneDrive"]) {
        data.source["OneDrive"] = snakeToCamel(data.source["OneDrive"]);
      }
      return { ok: data };
    } catch (error: any) {
      const status = error.response?.status;
      const knownError = error.response?.data?.error;
      if (status && knownError) {
        return { error: [status, knownError] };
      } else {
        return { unknownError: String(error) };
      }
    }
  }

  public static async updateSnapshotTask(
    interval: number | null,
    status: "Running" | "Paused" | null,
    oneDriveShareUrl: string | null
  ): Promise<Result<"ok">> {
    try {
      const body: any = {};
      if (interval) {
        body["interval"] = interval;
      }
      if (status) {
        body["status"] = status;
      }
      if (oneDriveShareUrl) {
        body["source"] = {
          OneDrive: camelToSnake({
            shareUrl: oneDriveShareUrl,
          }),
        };
      }

      const _ = await axios.patch(this.backendUrl + "snapshot_task", body, {
        headers: { Authorization: "Bearer " + this.getToken() },
      });

      return { ok: "ok" };
    } catch (error: any) {
      const status = error.response?.status;
      const knownError = error.response?.data?.error;
      if (status && knownError) {
        return { error: [status, knownError] };
      } else {
        return { unknownError: String(error) };
      }
    }
  }
}
