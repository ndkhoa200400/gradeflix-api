import { model, property } from "@loopback/repository";

@model()
export class UpdateStudentIdRequest {
    @property({
        type:'string'
    })
    studentId: string

    
}