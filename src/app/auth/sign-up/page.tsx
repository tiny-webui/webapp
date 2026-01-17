"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Eye, EyeOff, Mail, Lock, CheckCircle, ArrowRight } from "lucide-react";
import { getRegistrationString } from "@/sdk/registration"
import { copyToClipboard } from "@/lib/utils";

export default function SignUp() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

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
      const registrationString = getRegistrationString({
        username: formData.email,
        password: formData.password
      });
      await copyToClipboard(registrationString);
      setShowSuccessModal(true);
      console.log("Registration success");
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

  const handleGoToSignIn = () => {
    setShowSuccessModal(false);
    router.push("/auth/sign-in");
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
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setShowPrivacyModal(true)}
            >
              隐私政策
            </button>
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

      {/* Privacy policy modal */}
      <Modal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        title="隐私政策"
      >
        <div className="max-h-96 overflow-y-auto space-y-3 pr-1 text-sm text-foreground leading-relaxed">
          <p className="font-semibold">Tiny WebUI</p>
          <p>
            Tiny WebUI 仅会收集以下用户数据
            <li>1. 镜像源下载量</li>
          </p>
          <p className="font-semibold">设备管理员</p>
          <p>
            您的数据储存在部署服务端的设备上，且可被设备管理员访问
            <li>1. 模型配置信息</li>
            <li>2. 用户账户信息</li>
            <li>3. 对话信息</li>
            <li>4. 设置信息</li>
          </p>
          <p>
            您的密码受SPAKE2+保护，因此设备管理员无法直接读取明文，但可能通过暴力破解尝试获取明文
          </p>
          <p className="font-semibold">管理员用户</p>
          <p>
            管理员用户可访问以下数据
            <li>1. 用户名/邮箱</li>
          </p>
          <p className="font-semibold">模型供应商</p>
          <p>
            模型供应商可能会收集您的使用数据，具体请参阅相应模型供应商的隐私政策，Tiny WebUI不会对模型供应商收集的数据负责
          </p>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="凭证创建成功"
        showCloseButton={false}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="text-green-500 size-6" />
            <p className="text-foreground font-medium">
              凭证已复制到剪贴板
            </p>
          </div>
          
          <p className="text-sm text-foreground">
            请将此凭证提供给管理员完成注册。<br/>
            请勿分享或保存此凭证，凭证泄露可能导致您的密码被破解。
          </p>

          <div className="pt-2">
            <Button
              onClick={handleGoToSignIn}
              className="w-full"
            >
              前往登录页面
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
} 