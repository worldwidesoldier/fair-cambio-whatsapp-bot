const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Default error response
    let status = 500;
    let message = 'Erro interno do servidor';

    // Handle specific error types
    if (err.name === 'ValidationError') {
        status = 400;
        message = err.message;
    } else if (err.name === 'UnauthorizedError') {
        status = 401;
        message = 'Não autorizado';
    } else if (err.name === 'ForbiddenError') {
        status = 403;
        message = 'Acesso negado';
    } else if (err.name === 'NotFoundError') {
        status = 404;
        message = 'Recurso não encontrado';
    } else if (err.message) {
        message = err.message;
    }

    // Send error response
    res.status(status).json({
        error: message,
        timestamp: new Date().toISOString(),
        path: req.path
    });
};

const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = {
    errorHandler,
    asyncHandler
};