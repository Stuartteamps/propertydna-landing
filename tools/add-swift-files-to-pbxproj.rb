#!/usr/bin/env ruby
# Adds new Swift files to the App target of the PropertyDNA Xcode project.
# Idempotent — running it twice doesn't duplicate references.
#
# Run via:
#   GEM_HOME=/opt/homebrew/Cellar/cocoapods/1.16.2_2/libexec \
#     /opt/homebrew/opt/ruby/bin/ruby tools/add-swift-files-to-pbxproj.rb

require 'xcodeproj'

PROJECT_PATH = '/Users/danstuart/propertydna-landing/app/frontend/ios/App/App.xcodeproj'
APP_DIR      = '/Users/danstuart/propertydna-landing/app/frontend/ios/App/App'
NEW_FILES = %w[
  PropertyDNABridgeViewController.swift
  VisionScannerCoordinator.swift
  NativeMapPresenter.swift
  SpotlightIndexer.swift
  PropertyAppIntents.swift
  QuickActionsHandler.swift
]

project = Xcodeproj::Project.open(PROJECT_PATH)
target  = project.targets.find { |t| t.name == 'App' } || abort('App target not found')

# Find or create the "App" group that holds AppDelegate.swift
app_group = project.main_group.find_subpath('App', false)
unless app_group
  app_group = project.main_group.find_subpath('App', true)
  app_group.set_source_tree('<group>')
  app_group.set_path('App')
end

existing_refs = project.files.map { |f| File.basename(f.path.to_s) }

NEW_FILES.each do |name|
  if existing_refs.include?(name)
    puts "  skip (already in project): #{name}"
    next
  end
  ref = app_group.new_reference(name)
  ref.last_known_file_type = 'sourcecode.swift'
  target.add_file_references([ref])
  puts "  added: #{name}"
end

project.save
puts "Saved #{PROJECT_PATH}"
