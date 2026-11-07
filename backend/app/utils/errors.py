class AppError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


class EvaluationUnavailable(AppError):
    def __init__(self, message: str):
        super().__init__(400, "evaluation_unavailable", message)
