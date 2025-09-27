"use client";

import { useCallback, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { TUIClientSingleton } from '@/lib/tui-client-singleton';

export interface DeleteModelDialogProps {
	modelInfo: {
    id: string;
    name: string;
  };
	onComplete: () => void; // UI-only for now
}

export const DeleteModelDialog = ({ modelInfo, onComplete }: DeleteModelDialogProps) => {
	const [deleting, setDeleting] = useState(false);

	const deleteModelAsync = useCallback(async () => {
		setDeleting(true);
		try {
			await TUIClientSingleton.get().deleteModelAsync(modelInfo.id);
		} catch (err) {
			console.error('Failed to delete model', err);
		} finally {
			onComplete();
		}
	}, [modelInfo, onComplete]);

	return (
		<Modal
			isOpen={true}
			onClose={onComplete}
			title={"删除模型"}
		>
			{(deleting) && (
				<div className="flex w-full items-center justify-center py-8 gap-3 select-none" aria-live="polite">
					<div className="relative h-8 w-8" role="status" aria-label={deleting ? '正在删除' : '正在加载'}>
						<div className="absolute inset-0 rounded-full border-4 border-muted opacity-30" />
						<div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
					</div>
					<span className="text-sm text-muted-foreground">{deleting ? '删除中...' : '加载中...'}</span>
				</div>
			)}
			{(!deleting) && (
				<div className="flex flex-col gap-6">
					<p className="text-sm text-muted-foreground leading-relaxed">
						确定删除模型<span className="font-medium text-foreground">“{modelInfo.name}”</span>吗？
					</p>
					<div className="flex justify-end gap-3">
						<Button type="button" variant="outline" onClick={onComplete} disabled={deleting}>
							取消
						</Button>
						<Button type="button" variant="destructive" onClick={deleteModelAsync} disabled={deleting}>
							删除
						</Button>
					</div>
				</div>
			)}
		</Modal>
	);
};

