'use strict'
import bcryptjs from 'bcryptjs';
import mongodb from 'mongodb';
import User from '../models/user.model.js';
import { createToken } from '../services/jwt.js';
import { getDatabase } from '../index.js';
import logger from '../utils/logger.js';

const { compare, hashSync } = bcryptjs;
const { ObjectId } = mongodb;

/**
 * Handles the registration of a new user.
 * 
 * This function processes the user registration by validating the request body,
 * checking if the user already exists in the database, hashing the password, 
 * and then storing the user in the database.
 * 
 * @param {Object} req - The request object containing the body with user details.
 * @param {Object} res - The response object used to send back the appropriate HTTP response.
 * 
 * @returns {Promise<void>} Sends an HTTP response with the result of the registration process.
 * 
 * @example
 * // Example usage in an Express route:
 * router.post('/register', registerUser);
 * 
 * // Expected request body:
 * {
 *   "name": "John",
 *   "surname": "Doe",
 *   "nickname": "johndoe",
 *   "email": "johndoe@example.com",
 *   "password": "securepassword123"
 * }
 * 
 * // Possible responses:
 * // - 200: User John registered successfully
 * // - 200: User John already exists in our database
 * // - 400: Complete all fields
 * // - 404: User not registered
 * // - 500: Error message (if something went wrong)
 */

export const registerUser = async (req, res) => {

    try {

        const params = req.body;

        if (params.name && params.surname && params.nickname && params.email && params.password) {

            const user = new User(

                params.name,
                params.surname,
                params.nickname,
                params.email,
                params.password,
                'ROLE_USER',
                null

            );

            const existingUser = await getDatabase().collection('users').findOne({ email: user.email.toLowerCase() });

            if (existingUser) {
                logger.info('User ' + user.name + ' already exists in our database');
                return res.status(200).send({ message: 'User ' + user.name + ' already exists in our database' });
            }

            const hashedPassword = hashSync(params.password, 10);

            user.password = hashedPassword;

            const userStored = await getDatabase().collection('users').insertOne(user);

            if (userStored) {

                logger.info('User ' + user.name + ' registered successfully')
                return res.status(200).send({ message: 'User ' + user.name + ' registered successfully' });

            } else {
                logger.error('User not registered')
                return res.status(404).send({ message: 'User not registered' });
            }

        } else {
            logger.error('Complete all fields')
            return res.status(400).send({ message: 'Complete all fields' });

        }
    } catch (error) {

        logger.error(error)
        return res.status(500).send({ message: error });

    }
};
/**
 * Handles the login of a user.
 * 
 * This function processes user login by validating the request body, checking if the user exists in the database, 
 * comparing the provided password with the stored hashed password, and generating a token if the credentials are correct.
 * It also handles different scenarios based on whether a token should be returned or additional user information.
 * 
 * @param {Object} req - The request object containing the body with email and password.
 * @param {Object} res - The response object used to send back the appropriate HTTP response.
 * 
 * @returns {Promise<void>} Sends an HTTP response with the result of the login process.
 * 
 * @example
 * // Example usage in an Express route:
 * router.post('/login', loginUser);
 * 
 * // Expected request body:
 * {
 *   "email": "user@example.com",
 *   "password": "userpassword",
 *   "gettoken": true // Optional: Whether to return the token only or both token and user details.
 * }
 * 
 * // Possible responses:
 * // - 200: { token: "<token>" } if `gettoken` is true
 * // - 200: { token: "<token>", user: { ... } } if `gettoken` is false
 * // - 400: Complete all fields
 * // - 404: The email entered is not registered
 * // - 500: Password is incorrect or error message
 */
export const loginUser = async (req, res) => {
    try {

        const params = req.body;
        const email = params.email;
        const password = params.password;

        if (email && password) {

            const user = await getDatabase().collection('users').findOne({ email: email });

            if (user) {

                const passwordIsCorrect = await compare(password, user.password);

                if (passwordIsCorrect) {

                    const token = createToken(user);

                    if (params.gettoken) {

                        return res.status(200).send({ token });
                    } else {

                        user.password = undefined;
                        return res.status(200).send({ token, user });
                    }

                } else {

                    return res.status(500).send({ message: 'Password is incorrect' });
                }

            } else {

                return res.status(404).send({ message: 'The email entered is not registered' });
            }
        } else {

            return res.status(400).send({ message: 'Complete all fields' });
        }
    }

    catch (error) {

        return res.status(500).send({ message: error });
    }
};
// ----------------------------------------------
export const getUser = async (req, res) => {

    try {

        const userId = req.params.id;

        if (!ObjectId.isValid(userId)) {
            return res.status(400).send({ message: 'ID de usuario no válido' });
        }

        const user = await getDatabase().collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user)
            return res.status(404).send({ message: 'El Usuario no existe' });

        followThisUser(req.user.sub, userId).then((value) => {

            user.password = undefined;

            return res.status(200).send({
                user,
                following: value.following,
                followed: value.followed
            });
        });

    } catch (error) {

        return res.status(500).send({ message: error });
    }
}
// ----------------------------------------------
async function followThisUser(identity_user_id, user_id) {

    const following = await getDatabase().collection('user').findOne({ "user": identity_user_id, "followed": user_id });

    const followed = await getDatabase().collection('user').findOne({ "user": user_id, "followed": identity_user_id });
    return {
        following: following,
        followed: followed
    }
}
// ----------------------------------------------
export const getUsers = async (req, res) => {
    try {
        const users = await getDatabase().collection('users').find().toArray();

        users.forEach((user) => {
            user.password = undefined;
        });

        return res.status(200).send({ users });
    } catch (error) {
        console.error('Error al obtener la lista de usuarios:', error);
        return res.status(500).send({ message: 'Error en la petición' });
    }
};
// ----------------------------------------------
export const updateUser = async (req, res) => {
    try {

        const userId = req.params.id;
        const update = req.body;
        delete update.password;

        if (userId != req.user.sub) {
            return res.status(500).send({ message: 'No tienes permisos para actualizar datos' });
        }

        const filter = { _id: new ObjectId(userId) };

        const options = { upsert: true };

        var userIsset = false;

        users.forEach((user) => {
            if (user && user._id != userId) userIsset = true;
        });

        if (userIsset)
            return res.status(404).send({ message: 'los datos ya estan en uso' });

        findByIdAndUpdate(userId, update, { new: true, useFindAndModify: false },
            (err, userUpdated) => {

                if (err)
                    return res.status(500).send({ message: 'Existe un error en la peticion' });

                if (!userUpdated)
                    return res.status(404)
                        .send({ message: 'No se ha podido actualizar el usuario' });

                return res.status(200).send({ user: userUpdated });
            });

    } catch (error) {

        return res.status(500).send({ message: error });

    }

}

export default {
    registerUser,
    loginUser,
    getUsers,
}

//getImageFile,
//getCounters,
//getUser,
//updateUser,
//uploadImage,

// export function uploadImage(req, res) {

//     var userId = req.params.id;
//     if (req.files) {

//         var file_path = req.files.image.path;
//         var file_split = file_path.split('\\');
//         var file_name = file_split[2];
//         var ext_split = file_name.split('\.');
//         var file_ext = ext_split[1];

//         if (userId != req.user.sub) {

//             return removeFilesOfUploads(res, file_path,
//                 'No tienes permisos para actualizar datos');
//         }

//         if (file_ext == 'png' || file_ext == 'jpg' || file_ext == 'jepg' || file_ext == 'gif') {

//             findByIdAndUpdate(userId, { image: file_name },
//                 { new: true, useFindAndModify: false },
//                 (err, userUpdated) => {

//                     if (err) return res.status(500)
//                         .send({ message: 'Existe un error en la peticion' });

//                     if (!userUpdated) return res.status(404)
//                         .send({ message: 'No se ha podido actualizar el usuario' });

//                     return res.status(200).send({ user: userUpdated });
//                 });
//         } else {
//             return removeFilesOfUploads(res, file_path, 'extension no valida');
//         }
//     } else {
//         return res.status(200).send({ mesagge: ' no se han subido archivos' });
//     }
// }

// funciones

// async function followUserIds(user_id) {
//     try {

//         var following = await _find({ "user": user_id }).select({ '_id': 0, '__v': 0, 'user': 0 }).exec()
//             .then((follows) => { return follows; }).catch((err) => { return handleError(err) });

//         var followed = await _find({ "followed": user_id }).select({ '_id': 0, '__v': 0, 'followed': 0 }).exec()
//             .then((follows) => { return follows; }).catch((err) => { return handleError(err) });

//         var following_clean = [];
//         following.forEach((follow) => {
//             following_clean.push(follow.followed);
//         });

//         var followed_clean = [];
//         followed.forEach((follow) => {
//             followed_clean.push(follow.user);
//         });

//         return {
//             following: following_clean,
//             followed: followed_clean
//         }
//     } catch (e) {
//         console.log(e);
//     }
// }

// export function removeFilesOfUploads(res, file_path, mensage) {
//     unlink(file_path, (err) => {

//         return res.status(200).send({ mesagge: mensage });
//     });
// }

// export function getImageFile(req, res) {

//     var image_File = req.params.imageFile;

//     var path_file = './uploads/users/' + image_File;

//     _exists(path_file, (exists) => {

//         if (exists) {

//             res.sendFile(resolve(path_file));
//         } else {

//             res.status(200).send({ mesagge: 'no existe la imagen' });
//         }
//     });
// }

// export function getCounters(req, res) {

//     var userId = req.user.sub;

//     if (req.params.id) {
//         userId = req.params.id;
//     }

//     getCountFollow(userId).then((value) => {
//         return res.status(200).send(value);
//     });
// }

// async function getCountFollow(user_id) {

//     var following = await countDocuments({ "user": user_id })
//         .exec()
//         .then((count) => {
//             return count;
//         })
//         .catch((err) => { return handleError(err); });

//     var followed = await countDocuments({ "followed": user_id })
//         .exec()
//         .then((count) => {
//             return count;
//         })
//         .catch((err) => { return handleError(err); });

//     var publications = await _countDocuments({ 'user': user_id })
//         .exec()
//         .then((count) => {
//             return count;
//         })
//         .catch((err) => { return handleError(err); });
//     return {
//         following: following,
//         followed: followed,
//         publications: publications
//     }
// }