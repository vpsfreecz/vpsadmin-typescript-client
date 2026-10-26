require 'json'

mode, source = ARGV.shift(2)
raise 'An exact source checkout is required' unless source && %w[identity generate].include?(mode)

source = File.realpath(source)
shared_root = File.join(source, 'clients/ruby/lib')
typescript_root = File.join(source, 'clients/typescript/lib')

require 'haveapi/schema'
require 'haveapi/typescript_client'

%w[haveapi/schema.rb haveapi/schema/capture.rb haveapi/schema/fetch_command.rb
   haveapi/schema/snapshot.rb haveapi/client/version.rb].each do |logical|
  expected = File.realpath(File.join(shared_root, logical))
  loaded = $LOADED_FEATURES.select { |path| path.end_with?("/#{logical}") }
  unless loaded.length == 1 && File.realpath(loaded.first) == expected
    raise 'Shared schema source was not loaded from the exact checkout'
  end
end

generator_file = HaveAPI::TypeScriptClient::Generator.method(:source_digest).source_location.first
unless File.realpath(generator_file) == File.realpath(File.join(typescript_root, 'haveapi/typescript_client/generator.rb'))
  raise 'TypeScript generator was not loaded from the exact checkout'
end

if mode == 'identity'
  puts JSON.generate(
    generator_source_sha256: HaveAPI::TypeScriptClient::Generator.source_digest,
    shared_source_identity: HaveAPI::Schema.source_identity
  )
else
  load File.join(source, 'clients/typescript/bin/haveapi-typescript-client')
end
