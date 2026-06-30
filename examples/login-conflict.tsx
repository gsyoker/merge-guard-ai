import { loginWithPassword, loginWithSmsCode } from "../api/auth";

type LoginState = {
  username: string;
  password: string;
  phone: string;
  code: string;
};

export function LoginForm({ state }: { state: LoginState }) {
  async function submitLogin() {
<<<<<<< HEAD
    if (state.phone && state.code) {
      return loginWithSmsCode({ phone: state.phone, code: state.code });
    }
    return loginWithPassword({ username: state.username, password: state.password });
=======
    if (!state.password) {
      throw new Error("Password is required");
    }
    return loginWithPassword({
      username: state.username,
      password: state.password,
      lockAfterFailures: 5,
    });
>>>>>>> feature/password-lockout
  }

  return <button onClick={submitLogin}>Login</button>;
}
