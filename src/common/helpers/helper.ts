import { UserRepository } from "../../repositories";

async function checkUniqueStudentId(studentId: string, userRepository: UserRepository)
{
    const countStudentExisted = await userRepository.count({
        studentId: studentId
    })
    console.log("==== ~ countStudentExisted", countStudentExisted)

    return countStudentExisted.count === 0
}

export {checkUniqueStudentId}