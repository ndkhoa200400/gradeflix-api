import { model, property } from "@loopback/repository"

@model()
export class PaginatedRequestDto {
  @property({ type: 'number' })
  pageIndex: number
  
  @property({ type: 'number' })
  pageSize: number
  constructor(data?: Partial<PaginatedRequestDto>)
  {
    this.pageIndex = data?.pageIndex ?? 0
    this.pageSize = data?.pageSize ?? 0

  }
  
  @property({ type: 'number' })
  get skip(): number {
    return (this.pageIndex - 1) * this.pageSize
  }
}
