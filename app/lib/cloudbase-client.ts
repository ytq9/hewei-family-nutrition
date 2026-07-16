"use client";

type OtpVerifier = (input: { token: string }) => Promise<unknown>;
type CloudBaseAuth = {
  signInWithOtp: (input: { email: string; options: { shouldCreateUser: boolean } }) => Promise<{
    data?: { verifyOtp?: OtpVerifier };
    error?: { message?: string };
  }>;
};
type CloudBaseApp = {
  auth: () => CloudBaseAuth;
  callFunction: (input: Record<string, unknown>) => Promise<{ code?: string; message?: string; result?: unknown }>;
  uploadFile: (input: { cloudPath: string; filePath: File }) => Promise<{ fileID: string }>;
};

const envId = process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID ?? "";
const publishableKey = process.env.NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY ?? "";
let appPromise: Promise<CloudBaseApp> | null = null;
let otpVerifier: OtpVerifier | null = null;

export const cloudbaseConfigured = Boolean(envId && publishableKey);

async function getApp() {
  if (!cloudbaseConfigured) throw new Error("CloudBase 尚未配置");
  if (!appPromise) {
    appPromise = import("@cloudbase/js-sdk").then(({ default: cloudbase }) =>
      cloudbase.init({ env: envId, accessKey: publishableKey }) as unknown as CloudBaseApp,
    );
  }
  return appPromise;
}

export async function sendEmailOtp(email: string) {
  const app = await getApp();
  const auth = app.auth();
  const { data, error } = await auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw new Error(error.message ?? "验证码发送失败");
  if (!data?.verifyOtp) throw new Error("CloudBase 未返回验证码校验器");
  otpVerifier = data.verifyOtp;
}

export async function verifyEmailOtp(code: string) {
  if (!otpVerifier) throw new Error("请先发送验证码");
  const result = await otpVerifier({ token: code });
  otpVerifier = null;
  return result;
}

export async function callNutritionApi<T>(action: string, payload?: unknown): Promise<T> {
  const app = await getApp();
  const response = await app.callFunction({
    name: "nutrition-api",
    data: { action, payload },
    parse: true,
  });
  if (response?.code) throw new Error(response.message ?? "云函数调用失败");
  return response.result as T;
}

export async function uploadIngredientPhoto(file: File) {
  const app = await getApp();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const cloudPath = `ingredients/${Date.now()}-${safeName}`;
  const uploaded = await app.uploadFile({ cloudPath, filePath: file });
  return uploaded.fileID as string;
}

export async function analyzeIngredientPhoto(fileIds: string[]) {
  const app = await getApp();
  const response = await app.callFunction({ name: "vision-analyze", data: { fileIds }, parse: true });
  const result = response.result as { ok?: boolean; error?: string; data?: unknown } | undefined;
  if (response?.code || result?.ok === false) throw new Error(response?.message ?? result?.error ?? "识别失败");
  return result?.data as {
    candidates: Array<{ name: string; confidence: number; visibleWeightG: number | null }>;
  };
}
