Pod::Spec.new do |s|
  s.name           = 'NandamBiometrics'
  s.version        = '1.0.0'
  s.summary        = 'Hardware-backed Face ID / Touch ID signing keys for the Nandam Handlooms admin app'
  s.description    = 'Creates a P-256 key in the Secure Enclave, usable only after a biometric check, and signs sign-in challenges with it.'
  s.author         = 'Nandam Handlooms'
  s.homepage       = 'https://github.com/vishwanathgroviews/Nadam-Handloom'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'LocalAuthentication', 'Security', 'CryptoKit'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
