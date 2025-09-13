"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { TUIClientSingleton } from "@/lib/tui-client-singleton";

export default function SignIn() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    if (!TUIClientSingleton.exists()) {
      TUIClientSingleton.create(
        /** 
         * @todo This is only for debug. Change to the ws' address for release.
         */
        `${window.location.hostname}:12345`,
        (error) => {
          /** @todo Handle disconnect properly */
          console.error("TUIClient connection error: ", error);
        },
        () => {
          /** @todo Inform the user about the suspected attack. */
          console.log("This account was under attack.");
        }
      );
    }
    try {
      await TUIClientSingleton.get().connectAsync(email, password);
      console.log("Login successful");
      router.push("/chat");
    } catch (error) {
      console.error("Login failed: ", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-8 p-4">
      {/* 标题区域 */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          欢迎回来
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          请输入您的账户信息进行登录
        </p>
      </div>

      {/* 登录表单 */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          {/* 邮箱输入 */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              邮箱地址
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
              <Input
                id="email"
                type="email"
                placeholder="请输入邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* 密码输入 */}
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              密码
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 记住我和忘记密码 */}
        <div className="flex items-center justify-between">
          <a
            href="#"
            className="text-sm text-primary hover:underline"
          >
            忘记密码？
          </a>
        </div>

        {/* 登录按钮 */}
        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? "登录中..." : "登录"}
        </Button>
      </form>

      {/* 分割线 */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            或者
          </span>
        </div>
      </div>

      {/* 注册链接 */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          还没有账户？{" "}
          <a
            href="/auth/sign-up"
            className="text-primary hover:underline font-medium"
          >
            立即注册
          </a>
        </p>
      </div>
    </div>
  );
} 