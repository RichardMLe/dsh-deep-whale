import { type ReactNode } from 'react'
import css from './feedback-section.module.css'

/**
 * 官方意见反馈问卷入口(2026-10-02 新版迁移):与官方账号菜单的「意见反馈」
 * 同源 URL(官方包 contact-config.js 取证),按主人要求作为独立设置区块
 * 与「皮肤管理」「Agent 管理」并列。
 */
const CONTACT_FORM_URL =
  'https://trtgsjkv6r.feishu.cn/share/base/form/shrcnlCoGElW7MQznGy9r3YYXcg?hide_uid=1&hide_device_info=1&hide_harness_version=1'

export function FeedbackSection(): ReactNode {
  return (
    <div className={css.section}>
      <p className={css.desc}>遇到问题或有建议?填写官方反馈问卷,我们会尽快跟进。</p>
      <button type="button" className={css.button} onClick={() => { window.open(CONTACT_FORM_URL, '_blank', 'noopener') }}>
        打开反馈问卷
      </button>
    </div>
  )
}
