const jwtGenerator = require('../utils/token-generator');
const { Response } = require('cottage');
const emailService = require('../utils/email-service')();
const randomToken = require('../utils/random-token');
const originUrl = require('../configs/origin');
const controller = {
  name: 'AuthController',
};

controller.createMagicRequest = async (ctx) => {
  const trx = await ctx.db.transaction();
  try {
    const payload = ctx.request.body;

    if (!payload.tokenName || !payload.email) {
      return new Response(400, { error: `Email and TokenName are required` });
    }

    const token = randomToken();

    const recordToInsert = {
      token: token,
      token_name: payload.tokenName,
      email: payload.email,
    };

    const savedToken = await trx('tokens').insert(recordToInsert, [
      'token',
      'email',
    ]);

    const verificationLink =
      originUrl +
      `/confirm?email=${savedToken[0].email}&token=${savedToken[0].token}`;

    emailService.sendLoginVerification(savedToken[0].email, verificationLink);

    await trx.commit();

    return new Response(200, {
      data: {
        token: savedToken[0].token,
      },
    });
  } catch (err) {
    console.error(err);
    return new Response(err.code, err.message);
  }
};

controller.verifyMagicRequest = async (ctx) => {
  let trx;
  try {
    const payload = ctx.request.body;

    if (!payload.email || !payload.token) {
      return new Response(400, { error: `Bad Request` });
    }

    const tokens = await ctx
      .db('tokens')
      .where({
        email: payload.email,
        token: payload.token,
      })
      .select('is_verified as isVerified');

    if (!tokens.length) {
      return new Response(400, { error: `Invalid Token` });
    }

    const verified = tokens[0].isVerified || false;

    if (verified) {
      let userDetails = await ctx.db('users').where({
        email: payload.email,
      });

      if (!userDetails.length) {
        trx = await ctx.db.transaction();
        userDetails = await trx('users').insert(
          {
            email: payload.email,
          },
          ['id']
        );

        await trx.commit();
      }

      const token = await jwtGenerator(userDetails[0]);
      return new Response(200, {
        data: {
          verified: verified,
          token: token,
        },
      });
    }

    return new Response(200, {
      data: {
        verified: verified,
      },
    });
  } catch (err) {
    if (trx) {
      await trx.rollback();
    }
    console.error(err);
    return new Response(err.code, err.message);
  }
};

controller.confirmMagicRequest = async (ctx) => {
  let trx;
  try {
    const payload = ctx.request.query;

    if (!payload.email || !payload.token) {
      return new Response(400, { error: `Bad Request` });
    }

    const tokens = await ctx
      .db('tokens')
      .where({
        email: payload.email,
        token: payload.token,
      })
      .select('is_verified as isVerified');

    if (!tokens.length) {
      return new Response(400, { error: `Invalid Token` });
    }

    const verified = tokens[0].isVerified || false;

    if (verified) {
      return new Response(400, {
        error: `The token is no more valid, Please request for a new one`,
      });
    }

    trx = await ctx.db.transaction();

    await trx('tokens').update('is_verified', true);

    await trx.commit();

    return new Response(200, {
      data: {
        verified: true,
      },
    });
  } catch (err) {
    if (trx) {
      await trx.rollback();
    }
    console.error(err);
  }
};

module.exports = controller;
