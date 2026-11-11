export const validateSchema = (schema) => {
    return async (req, res, next) => {
       try {
           await schema.parse(req.body);
           next();
       } catch (error) {
            console.log(error);
            res.status(400).json(error.issues);
       }
    };
};