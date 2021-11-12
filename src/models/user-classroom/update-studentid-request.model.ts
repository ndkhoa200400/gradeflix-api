import { model, property } from "@loopback/repository";

@model()
export class UpdateStudentidRequest {
    @property({
        type:'string'
    })
    studentId: string

    
}