// TODO: type safe?
/* eslint-disable @typescript-eslint/no-explicit-any */

//TODO: this file is bascially a duplication of frontend/src/time-machine/Api.ts
// we should try to reuse that

import axios from "axios";
import lodash from "lodash";

// I really want ADT x2
type Ok<T> = {
  status: number;
  ok: T;
  error?: never;
  unknownError?: never;
};

type Error = {
  status: number;
  ok?: never;
  error: string;
  unknownError?: never;
};

type UnknownError = {
  status: number | null;
  ok?: never;
  error?: never;
  unknownError: string;
};

type Result<T> = Ok<T> | Error | UnknownError;

export type SnapshotInfo = {
  id: number;
  timestamp: Date;
  downloadToken: string;
  prev: { id: number; timestamp: Date } | null;
  next: { id: number; timestamp: Date } | null;
};

// TODO: [snakeToCamel] and [camelToSnake] are very silly.
function snakeToCamel(x: any): any {
  lodash.map;
  return lodash.mapKeys(x, function (_value, key) {
    return lodash.camelCase(key);
  });
}

export default class TimeMachineApi {
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

  public static async requestApi(
    url: string,
    method: "get" | "post" | "patch" | "delete",
    needToken: boolean,
    responseType: "json" | "arraybuffer",
    data?: { [key: string]: any }
  ): Promise<Result<any>> {
    try {
      console.log("requesting api:", method, " ", url);
      const headers = needToken
        ? { Authorization: "Bearer " + this.getToken() }
        : undefined;
      const response = await axios({
        method,
        url: this.backendUrl + url,
        data,
        headers,
        responseType,
      });
      return { status: response.status, ok: response.data };
    } catch (error: any) {
      const status = error.response?.status;
      const knownError = error.response?.data?.error;
      const e: Error | UnknownError =
        status && knownError
          ? { status: status, error: knownError }
          : { status: status, unknownError: String(error) };

      console.log("api error:", e);
      return e;
    }
  }

  public static async getSnapshotInfo(
    snapshotId: number
  ): Promise<Result<SnapshotInfo>> {
    const result = await this.requestApi(
      "snapshot/" + String(snapshotId) + "/editor_view",
      "get",
      true,
      "json"
    );
    if (result.ok) {
      result.ok = snakeToCamel(result.ok);
    }
    return result;
  }

  public static async downloadSnapshot(downloadToken: string): Promise<Result<ArrayBuffer>> {
    return this.requestApi(
      "misc/download?token=" + downloadToken,
      "get",
      false,
      "arraybuffer"
    );
  }
}
