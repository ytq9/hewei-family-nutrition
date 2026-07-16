import { z } from "zod";

export const emailSchema = z.string().trim().email("请输入有效邮箱地址");
export const otpSchema = z.string().regex(/^\d{6}$/, "请输入 6 位验证码");

export const memberSchema = z.object({
  name: z.string().trim().min(1, "请输入成员姓名").max(20),
  relation: z.string().trim().min(1, "请输入与家庭的关系").max(20),
  birthday: z.string().min(1, "请选择生日"),
  driSex: z.enum(["female", "male"]),
});

export const recipeSchema = z.object({
  name: z.string().trim().min(1, "请输入菜名").max(40),
  ingredientName: z.string().trim().min(1, "请输入食材名称").max(40),
  amountG: z.coerce.number().positive("重量必须大于 0").max(20_000),
  yieldServings: z.coerce.number().positive("份数必须大于 0").max(50),
});
