export const success = (data = {}, message = 'Success') => ({
  success: true,
  message,
  ...data,
})

export const fail = (message = 'Something went wrong') => ({
  success: false,
  message,
})