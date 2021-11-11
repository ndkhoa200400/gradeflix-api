import { model, property } from "@loopback/repository"

@model()
export class PaginatedRequestDto {
  @property({ type: 'number' })
  pageIndex: number
  
  @property({ type: 'number' })
  pageSize: number
  
  @property({ type: 'number' })
  get skip(): number {
    return (this.pageIndex - 1) * this.pageSize
  }
}
