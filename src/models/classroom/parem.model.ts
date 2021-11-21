import { Entity, model, property } from '@loopback/repository'

@model()
export class Parem extends Entity {
  @property({
    type: 'string',
  })
  name: string

  @property({
    type: 'string',
  })
  percent: string
  constructor(data?: Partial<Parem>) {
    super(data)
  }
}

@model()
export class GradeStructure extends Entity {
  @property({
    type: 'string',
  })
  total: string

  @property.array(Parem, {
    postgresql: {
      dataType: 'jsonb',
    },
  })
  parems: Parem[]

  constructor(data?: Partial<GradeStructure>) {
    super(data)
  }
}
