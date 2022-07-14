export default class Api {
  static readonly tokenKey = "user-token";

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

  public static async getUserInfo() {
    return null;
  }
}
