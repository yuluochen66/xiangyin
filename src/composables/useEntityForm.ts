/**
 * 流程 3「手工新增 / 编辑实体」的表单状态。
 *
 * 唯一职责：持有表单字段与控制弹窗开合，并提供打开新增、打开编辑、关闭、别名解析
 * 这些表单级操作；接口调用与本地数据回写由视图和 useEntitySave 负责。
 */
import { reactive, ref } from 'vue'
import type { Ref } from 'vue'

import type { EntityKind, ExtractedEntity } from '@/types/api'

/** 手工新增 / 编辑实体的表单。 */
export interface EntityForm {
  entityId: string
  kind: EntityKind
  name: string
  normalizedName: string
  aliases: string
  uncertaintyNote: string
}

export interface UseEntityFormApi {
  form: EntityForm
  formOpen: Ref<boolean>
  /** 清空并打开表单（新增）。 */
  openCreateForm: () => void
  /** 用某条实体的内容填充并打开表单（编辑）。 */
  openEditForm: (entity: ExtractedEntity) => void
  /** 关闭弹窗，已填内容保留。 */
  closeForm: () => void
  /** 把逗号 / 顿号 / 分号分隔的别名串解析成数组。 */
  parseAliases: (input: string) => string[]
}

/**
 * 创建表单状态。
 * @returns 表单字段、弹窗开合状态，以及打开 / 关闭 / 解析别名的方法
 */
export function useEntityForm(): UseEntityFormApi {
  const formOpen = ref(false)
  const form = reactive<EntityForm>({
    entityId: '',
    kind: 'place',
    name: '',
    normalizedName: '',
    aliases: '',
    uncertaintyNote: '',
  })

  function openCreateForm(): void {
    Object.assign(form, {
      entityId: '',
      kind: 'place',
      name: '',
      normalizedName: '',
      aliases: '',
      uncertaintyNote: '',
    })
    formOpen.value = true
  }

  function openEditForm(entity: ExtractedEntity): void {
    Object.assign(form, {
      entityId: entity.id,
      kind: entity.kind,
      name: entity.name,
      normalizedName: entity.normalizedName,
      aliases: entity.aliases.join('、'),
      uncertaintyNote: entity.uncertaintyNote ?? '',
    })
    formOpen.value = true
  }

  function closeForm(): void {
    formOpen.value = false
  }

  function parseAliases(input: string): string[] {
    return input
      .split(/[,，、;；]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }

  return { form, formOpen, openCreateForm, openEditForm, closeForm, parseAliases }
}
