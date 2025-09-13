"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Mail, Lock, User, CheckCircle } from "lucide-react";
import { register } from "@/sdk/registration"

export default function SignUp() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (formData.username.trim() === "") {
      newErrors.username = "请输入用户名";
    }

    if (formData.email.trim() === "") {
      newErrors.email = "请输入邮箱地址";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "请输入有效的邮箱地址";
    }

    /** DO NOT trim the password. Every character counts. */
    if (formData.password === "") {
      newErrors.password = "请输入密码";
    } else if (formData.password.length < 6) {
      newErrors.password = "密码至少需要6个字符";
    }

    if (formData.confirmPassword === "") {
      newErrors.confirmPassword = "请确认密码";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "两次输入的密码不一致";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      /** This should be considered as user credential. DO NOT log it or keep it in ram!!! */
      const registrationString = register({
        username: formData.email,
        password: formData.password,
        publicMetadata: { displayName: formData.username }
      });
      console.log("Registration success");
      /** @todo Show the registration string in a new page? Or in a pop up? */
    } catch (error) {
      console.error("Registration failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    /** Clear error message for the field */
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="w-full max-w-md space-y-8 p-4">
      {/* Title */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          创建账户
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          请填写以下信息获取注册凭证
        </p>
      </div>

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          {/* User name */}
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium text-foreground">
              用户名
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名"
                value={formData.username}
                onChange={(e) => handleInputChange("username", e.target.value)}
                className={`pl-10 ${errors.username ? "border-destructive" : ""}`}
                required
              />
            </div>
            {errors.username && (
              <p className="text-sm text-destructive">{errors.username}</p>
            )}
          </div>

          {/* Email */}
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
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                required
              />
            </div>
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          {/* Password */}
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
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                className={`pl-10 pr-10 ${errors.password ? "border-destructive" : ""}`}
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
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
          </div>

          {/* Password check */}
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
              确认密码
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="请再次输入密码"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                className={`pl-10 pr-10 ${errors.confirmPassword ? "border-destructive" : ""}`}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirmPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword}</p>
            )}
          </div>
        </div>

        {/* Term of use */}
        <div className="flex items-start space-x-2">
          <input
            id="terms"
            type="checkbox"
            className="mt-1 rounded border-input bg-background text-primary focus:ring-ring focus:ring-offset-2"
            required
          />
          <label htmlFor="terms" className="text-sm text-muted-foreground">
            我已阅读并同意{" "}
            <a href="#" className="text-primary hover:underline">
              服务条款
            </a>{" "}
            和{" "}
            <a href="#" className="text-primary hover:underline">
              隐私政策
            </a>
          </label>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? "注册中..." : "创建账户"}
        </Button>
      </form>

      {/* Split line */}
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

      {/* Login link */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          已有账户？{" "}
          <a
            href="/auth/sign-in"
            className="text-primary hover:underline font-medium"
          >
            立即登录
          </a>
        </p>
      </div>
    </div>
  );
} 