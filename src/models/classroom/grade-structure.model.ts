import { Entity, model, property } from '@loopback/repository'

@model()
export class GradeComposition extends Entity {
  @property({
    type: 'string',
  })
  name: string

  @property({
    type: 'string',
  })
  percent: string

  @property({
    type: 'boolean',
    default: false 
  })
  isFinal: boolean
  
  constructor(data?: Partial<GradeComposition>) {
    super(data)
  }
}

@model()
export class GradeStructure extends Entity {
  @property({
    type: 'string',
  })
  total: string

  @property.array(GradeComposition, {
    postgresql: {
      dataType: 'jsonb',
    },
  })
  gradeCompositions: GradeComposition[]

  constructor(data?: Partial<GradeStructure>) {
    super(data)
  }
}
